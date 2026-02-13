# @clean-os/convex

Shared Convex backend package for JoluAI.

## Client usage

Import API references and data model types from this package:

```ts
import { api } from "@clean-os/convex/api";
import type { Id, Doc } from "@clean-os/convex/data-model";
```

## Convex commands

Run from this package directory:

```bash
bun run dev
bun run codegen
bun run deploy
bun run test
bun run typecheck
```

Convex functions live in `convex/`.
