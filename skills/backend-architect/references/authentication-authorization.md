# Authentication and authorization

Authenticate at the delivery boundary and authorize business operations inside
the use case. Never pass a raw access token, JWT library object, or FastAPI
security object into ordinary application code. Credential-lifecycle use cases
may accept a typed secret value for refresh/rotation and must immediately
verify/digest it without logging or persisting the raw credential.

## Contents

- [Principal model](#principal-model)
- [JWT validation dependency](#jwt-validation-dependency)
- [Token profiles and clean-architecture placement](#token-profiles-and-clean-architecture-placement)
- [Token transport and optional authentication](#token-transport-and-optional-authentication)
- [Stateful token storage and freshness](#stateful-token-storage-and-freshness)
- [Atomic refresh rotation](#atomic-refresh-rotation)
- [Logout semantics](#logout-semantics)
- [Resource authorization](#resource-authorization)
- [Failure semantics](#failure-semantics)

## Principal model

Represent trusted authentication facts as a small immutable application value:

```python
# domain/security/principal.py
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Principal:
    actor_id: UUID
    tenant_id: UUID | None
    roles: frozenset[str]
    scopes: frozenset[str]
    token_id: str | None
    session_id: str | None
    preferred_locale: str | None
```

- Map JWT `sub` to an immutable actor ID, never an email or mutable username.
- Map `jti` to `token_id` and `sid` to `session_id` when those claims exist.
- Include only claims the application actually uses. `preferred_locale` is
  non-authoritative convenience data and may remain stale until token renewal.
- Keep identity claims separate from the persisted `UserEntity`.
- Treat roles/scopes as token-time facts. Reload current membership, account
  status, or permissions in the use case when freshness matters.
- Never put secrets or unnecessary personal data in a signed JWT. JWS claims are
  encoded and integrity-protected, not confidential; use JWE only when token
  encryption is explicitly required.

## JWT validation dependency

Use a FastAPI dependency to extract the bearer token, ask a domain/application
port to validate it, and convert typed claims into `Principal`. The concrete
verifier belongs in infrastructure; the dependency belongs in
`entrypoints/http/dependencies.py`.

```python
from typing import Annotated
from uuid import UUID

from dishka.integrations.fastapi import FromDishka, inject
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer = HTTPBearer(auto_error=False)


@inject
async def get_principal(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer),
    ],
    verifier: FromDishka[AccessTokenVerifierInterface],
) -> Principal:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = await verifier.verify(credentials.credentials)
    except InvalidAccessTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    return Principal(
        actor_id=UUID(claims.subject),
        tenant_id=claims.tenant_id,
        roles=frozenset(claims.roles),
        scopes=frozenset(claims.scopes),
        token_id=claims.token_id,
        session_id=claims.session_id,
        preferred_locale=claims.preferred_locale,
    )


AuthenticatedPrincipal = Annotated[Principal, Depends(get_principal)]
```

The verifier MUST:

- Allowlist acceptable algorithms; never trust the token's `alg` choice alone.
- Verify every signature/MAC operation and reject unsecured or invalid tokens.
- Require and validate the expected issuer, audience, subject, and expiration.
- Validate `iat` and `nbf` according to the configured clock-skew policy.
- Enforce an explicit access-token type/purpose.
- Return a typed claims object only after all checks pass.
- Normalize expected parse/signature/claim failures to
  `InvalidAccessTokenError`; let configuration and infrastructure failures
  propagate.

Signing/verification keys, accepted algorithms, issuer, audience, clock skew,
and token lifetimes come from validated `Config`. Never hardcode them or accept
algorithm/key choices from an untrusted token.

## Token profiles and clean-architecture placement

Access and refresh tokens are different credentials. Give them mutually
exclusive validation profiles:

- `AccessTokenVerifierInterface` accepts only access tokens intended for this
  API and is the only verifier used by `get_principal`.
- `RefreshTokenVerifierInterface` or an opaque-token verifier is used only by
  refresh-session use cases.
- Reject a cryptographically valid refresh token at an access-token boundary,
  and reject an access token at the refresh boundary.
- Prefer distinct `typ`, audience, validation rules, and keys when practical.

Keep dependencies pointing inward:

```text
domain/security/principal.py          # Principal and trusted claim values
domain/interfaces/access_tokens.py    # verifier/issuer ports
infrastructure/security/jwt.py        # JWT library and key handling
entrypoints/http/dependencies.py      # bearer extraction + HTTP errors
providers/security.py                 # interface → adapter wiring
```

The cryptographic adapter may import the JWT library. Domain code, use cases,
and workflows never import it.

Bind the infrastructure implementation to its inward-facing port at application
scope; token verification must not depend on request-scoped objects:

```python
class SecurityProvider(Provider):
    scope = Scope.APP

    verifier = provide(
        JwtAccessTokenVerifier,
        provides=AccessTokenVerifierInterface,
    )
```

Follow
[JWT Best Current Practices (RFC 8725)](https://www.rfc-editor.org/info/rfc8725/)
and the base
[JWT specification (RFC 7519)](https://www.rfc-editor.org/info/rfc7519/).

## Token transport and optional authentication

- Send access tokens in the `Authorization: Bearer` header.
- Send refresh tokens in a typed request body or a Secure, HttpOnly,
  appropriately scoped cookie according to the client architecture.
- Never put bearer or refresh tokens in URLs/query parameters, logs, exception
  messages, analytics, or traces.
- Ensure request/response serializers do not accidentally expose token claims or
  stored session metadata.

For optional authentication, configure bearer extraction with
`auto_error=False` and distinguish:

- no credential supplied → `None`
- credential supplied but invalid → HTTP 401

Do not catch every `HTTPException` or token error and silently downgrade an
invalid credential to anonymous access.

Follow
[OAuth 2.0 Bearer Token Usage (RFC 6750)](https://www.rfc-editor.org/info/rfc6750/)
for bearer transport requirements.

## Stateful token storage and freshness

Keep stateful session/token storage for refresh-token rotation, logout,
revocation, compromised-session response, device management, and audit needs.
A useful session record contains an opaque ID, actor ID, refresh-token digest or
`jti`, token family/grant ID, expiry, rotation/revocation timestamps, and
optional device metadata.

Never persist a raw bearer token. Store opaque refresh-token values as one-way
digests. When refresh tokens are JWTs, store the minimum identifier and state
needed for rotation/revocation rather than the serialized credential.
Access-token rows are optional and should exist only when the chosen revocation
model requires them.

Do not query or update token state on every ordinary request when a short-lived
access JWT can be validated locally and the accepted staleness window is its
remaining lifetime. Avoid a per-request `last_used_at` database write; update
session activity on refresh, rate-limit it, or emit telemetry asynchronously.

Local JWT validation cannot observe state changes made after issuance. For
endpoints requiring immediate revocation or current security state, additionally
check one of:

- the token/session record by `jti` or session identifier
- a per-user/session version or revoked-before timestamp
- an authorization-server introspection endpoint
- current account, tenant-membership, or permission data inside the use case

Cache freshness checks only for a duration compatible with the endpoint's risk;
never beyond token expiry. RFC 7662 explicitly describes the security/load
tradeoff introduced by cached introspection responses:
[OAuth 2.0 Token Introspection](https://www.rfc-editor.org/info/rfc7662/).

Document which endpoint categories require fresh state. Stateful storage does
not provide immediate revocation unless the request path actually consults that
state, directly or through a bounded cache.

## Atomic refresh rotation

Refresh rotation is one atomic use case and one UoW transaction:

```python
class RotateRefreshTokenUseCase:
    async def __call__(self, command: RotateRefreshTokenCommand) -> TokenPair:
        token = command.refresh_token.get_secret_value()
        claims = await self.verifier.verify(token)
        digest = self.digester.digest(token)

        async with self.uow:
            session = await self.uow.sessions.consume_active_refresh(
                digest=digest,
                token_id=claims.token_id,
            )
            if session is None:
                await self._handle_possible_replay(digest)
                raise InvalidRefreshToken()

            actor = await self.uow.users.get(session.actor_id)
            if actor is None or actor.disabled:
                raise InvalidRefreshToken()

            pair = self.issuer.issue_pair(actor=actor, session=session)
            await self.uow.sessions.store_rotated_refresh(
                session=session,
                digest=self.digester.digest(pair.refresh_token),
                token_id=pair.refresh_token_id,
            )
            return pair
```

Consume the presented refresh token atomically—for example with a conditional
`UPDATE ... WHERE consumed_at IS NULL AND revoked_at IS NULL RETURNING ...` or a
row lock—so concurrent requests cannot both rotate it. Preserve the token-family
relationship. Reuse of an already-consumed token is a replay signal: revoke the
active family and require fresh authentication.

Revoking the old refresh token and storing its replacement must commit together.
If issuing or storing the replacement fails, rollback must leave the old token
usable. Refresh tokens for public clients must use rotation with replay
detection or be sender-constrained; follow
[OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/info/rfc9700/).

## Logout semantics

Define the product guarantee explicitly:

- **Logout current session:** revoke the current `sid`/refresh-token family.
- **Logout all sessions:** revoke every family or advance an actor-level
  `revoked_before`/security version.
- **Password reset or account compromise:** normally revoke all refresh families
  and require fresh state on sensitive endpoints.

Locally verified access JWTs remain valid until expiry unless the request path
checks session state, a security version, or `revoked_before`. Do not claim that
deleting a refresh token immediately invalidates already-issued access tokens.
Keep access tokens short-lived and configure their lifetime according to the
accepted revocation window.

## Resource authorization

Use the principal dependency only to authenticate the caller and carry trusted
claims. Pass the needed actor data into the command, then load and authorize the
resource inside the use case's UoW:

```python
@router.patch("/{tweet_id}", response_model=TweetEntity, operation_id="updateTweet")
async def update_tweet(
    tweet_id: UUID,
    body: UpdateTweetParams,
    principal: AuthenticatedPrincipal,
    use_case: FromDishka[UpdateTweetUseCase],
) -> TweetEntity:
    return await use_case(
        UpdateTweetCommand(
            actor_id=principal.actor_id,
            tweet_id=tweet_id,
            text=body.text,
        )
    )
```

```python
class UpdateTweetUseCase:
    async def __call__(self, command: UpdateTweetCommand) -> TweetEntity:
        async with self.uow:
            tweet = await self.uow.tweets.get_owned(
                command.tweet_id,
                command.actor_id,
            )
            if tweet is None:
                raise TweetNotFound()
            tweet.rename(command.text)
            return await self.uow.tweets.update(tweet)
```

Do not load an `Owned*` entity in a FastAPI dependency and pass it into a second
transaction. Keeping lookup, authorization, and mutation together avoids stale
authorization decisions. Pass the full `Principal` only when policies require
tenant, role, scope, or actor-type context; otherwise pass `actor_id`.

## Failure semantics

- Missing, malformed, expired, or invalid tokens → HTTP 401 with
  `WWW-Authenticate: Bearer`.
- Authenticated caller lacking permission → HTTP 403 when the policy may reveal
  the resource; enforce business scopes and roles in the use case.
- Missing or unauthorized owned resource → use the same application error and
  map it to HTTP 404 when existence must not be disclosed.
- Never reveal token-validation details to the caller; retain safe diagnostic
  detail only in internal logs.
