# Temporal Python patterns

Read this only when implementing Temporal Python SDK adapters. Verify exact API
names against the installed SDK and current official documentation.

## Schedule by registered activity name

Keep DTOs side-effect free and avoid importing an infrastructure-heavy activity
module into the workflow sandbox.

```python
from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow


@dataclass(frozen=True, slots=True)
class GenerateInput:
    operation_id: str
    logical_attempt: int


@dataclass(frozen=True, slots=True)
class GenerateResult:
    item_id: str


@workflow.defn(name="generate-item-workflow")
class GenerateItemWorkflow:
    @workflow.run
    async def run(self, command: GenerateInput) -> GenerateResult:
        return await workflow.execute_activity(
            "generate-item",
            command,
            result_type=GenerateResult,
            start_to_close_timeout=timedelta(minutes=10),
            heartbeat_timeout=timedelta(seconds=30),
        )
```

If DTOs live in another module, import only that checked, side-effect-free module
inside `workflow.unsafe.imports_passed_through()`.

## Scope an activity invocation

Bind the application container to the adapter, then create one request scope per
activity attempt.

```python
from dishka import AsyncContainer
from temporalio import activity


class ItemActivities:
    def __init__(self, container: AsyncContainer) -> None:
        self._container = container

    @activity.defn(name="generate-item")
    async def generate_item(self, command: GenerateInput) -> GenerateResult:
        async with self._container() as request_container:
            operation = await request_container.get(GenerateItemUseCase)
            result = await operation(
                operation_id=command.operation_id,
                logical_attempt=command.logical_attempt,
            )
        return GenerateResult(item_id=result.id)
```

Register the bound method, not the adapter class. Let the resolved application
operation own UoWs, validation, authorization, and stale-attempt fencing.

## Start a stable logical execution

Start by registered workflow name from non-worker processes to avoid importing
the sandboxed workflow package.

```python
from datetime import timedelta

from temporalio.common import (
    WorkflowIDConflictPolicy,
    WorkflowIDReusePolicy,
)


await client.start_workflow(
    config.workflow_name,
    command,
    id=f"resource/{command.resource_id}/{command.logical_attempt}",
    task_queue=config.task_queue,
    id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
    id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
    rpc_timeout=timedelta(seconds=config.command_rpc_timeout_seconds),
)
```

Use these duplicate policies only when the same workflow ID represents the same
durable obligation. Keep connection/TLS setup in the infrastructure gateway.
