# Production-Grade Backend Services for DeFi Liquidation Operations [![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Runtime-Bun-black?style=for-the-badge&logo=bun)](https://bun.sh/) [![AWS](https://img.shields.io/badge/Cloud-AWS-orange?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/) [![Radix DLT](https://img.shields.io/badge/DLT-Radix-blue?style=for-the-badge)](https://www.radixdlt.com/)

This repository contains the application services behind **Weft Finance**, a decentralized lending protocol built on **Radix DLT**.

While the [companion infrastructure repository](https://github.com/atoumbre/weft-backend-resources) provisions the AWS platform with Terraform, this repository contains the backend workloads that run on top of it: services that evaluate collateral health, partition and process protocol state, identify liquidation candidates, and execute time-sensitive actions against the Radix network.

From a portfolio and engineering perspective, this project demonstrates practical experience in **distributed backend design**, **event-driven processing**, **TypeScript monorepo architecture**, **cloud-native workload decomposition**, **cost-aware service design**, and **production-focused operational thinking**.

---

## What This Project Demonstrates

This project highlights hands-on capability in areas that are highly relevant to backend, cloud, platform, and infrastructure-oriented engineering roles:

- designing backend services for a time-sensitive financial workload,
- structuring a monorepo into shared packages, core services, and deployment adapters,
- separating business logic from runtime-specific delivery mechanisms,
- building queue-friendly processing flows with explicit fault isolation,
- handling asynchronous execution safely through validation and idempotent patterns,
- aligning service design with operational constraints such as cost, latency, and recoverability.

---

## Project Context

Weft Finance must continuously assess the health of a large set of **Collateralized Debt Positions (CDPs)**. When market conditions change and a position becomes unsafe, the backend must detect that condition quickly, process it at scale, and submit liquidation transactions reliably enough to help preserve protocol solvency.

That creates a demanding backend problem with three competing pressures:

- maintain a near-current operational view of on-ledger state,
- process large numbers of positions efficiently,
- react quickly during liquidation bursts without permanently paying for peak compute.

This repository contains the services that implement that execution model.

---

## How This Repository Fits into the Platform

The Weft backend is intentionally split across two repositories:

- **[weft-backend-resources](https://github.com/atoumbre/weft-backend-resources)** defines the cloud platform: queues, schedulers, ECS services, Lambda triggers, storage, observability, and deployment automation.
- **[weft-backend-services](https://github.com/atoumbre/weft-backend-services)** defines the executable workloads that run on that platform.

Together, they form a single backend system.

---

## Service Architecture Overview

The backend follows a scheduled control-loop model with asynchronous internal processing.

At a high level, the operating flow is:

1. a scheduler triggers the dispatcher on a fixed cadence,
2. the dispatcher partitions the indexing workload,
3. indexer workers process those batches and compute protocol health,
4. liquidation candidates are pushed into an execution queue,
5. the liquidator validates that each candidate is still actionable before submitting a transaction.

This is a deliberate design choice. It favors **operational simplicity**, **clear queue boundaries**, **scalable burst handling**, and **cost control** over a more complex always-on streaming architecture.

The services in this repository implement the application side of that model.

---

## Monorepo Structure

The repository is organized as a monorepo with clear separation between reusable libraries, protocol-facing services, and cloud runtime adapters.

### `packages/` — Shared Libraries and Internal SDKs

This layer contains reusable libraries that support the rest of the system. These packages are intentionally kept as reusable building blocks rather than service-specific entrypoints.

Examples include:

- `@weft-finance/ledger-state` for interacting with Radix ledger and gateway state,
- `@weft-finance/state-fetcher` for cached reads, aggregation, and state access patterns,
- `@local-packages/common-utils` for shared logging, configuration, and utility helpers,
- `@local-packages/typescript-wallet` for transaction-building and cryptographic utilities.

### `services/` — Core Application Workloads

This layer contains the protocol-facing backend logic. It is where the main operational responsibilities live: reading protocol state, evaluating risk, preparing work units, and executing protocol actions.

Core services include:

- **Dispatcher** for workload partitioning and queue orchestration,
- **Indexer** for batch processing and liquidation candidate detection,
- **Liquidator** for execution of time-sensitive liquidation transactions,
- **Price Updater** for maintaining the protocol’s external pricing inputs and related update flows.

### `aws-wrappers/` — Runtime Adapters and Deployment Targets

This layer contains the runtime-specific entrypoints that connect the core services to AWS execution environments such as Lambda and ECS.

Examples include:

- Lambda wrappers for event-driven functions such as dispatcher, liquidator, or price update handlers,
- containerized entrypoints for long-running or queue-driven workers such as indexers,
- adapter code that maps AWS events, environment variables, and queue payloads into service calls.

This separation keeps core logic portable and easier to test, while allowing deployment concerns to evolve independently.

---

## Core Services

### Dispatcher

The **Dispatcher** is the orchestration entrypoint for the indexing cycle.

Its job is to determine what range or set of protocol state needs to be evaluated, partition that work into manageable batches, and enqueue those batches for downstream processing. It is intentionally lightweight. It does not perform heavy protocol computation itself; instead, it exists to coordinate work predictably and cheaply.

### Indexer

The **Indexer** is the main processing service.

It consumes batch work units, fetches the relevant protocol state, evaluates collateral health and risk conditions, and identifies liquidation candidates. It can also materialize derived outputs needed by downstream execution or analysis layers.

This service is built for queue-driven scaling and variable workloads. It is the main computational tier in the application layer.

### Liquidator

The **Liquidator** is the execution-oriented service in the backend design. Its intended role is to consume validated liquidation candidates, re-check that each candidate is still actionable, construct the required transaction, and submit it to the Radix network.

In the public version of this repository, the concrete liquidation execution logic is intentionally not included. The team chose not to expose the transaction-building and execution implementation publicly. As a result, the repository currently stops at the stage of identifying and logging unhealthy CDPs rather than broadcasting live liquidation transactions.

This means the public codebase demonstrates the detection, evaluation, and operational workflow around liquidation readiness, while the sensitive execution layer remains private.

### Price Updater

The **Price Updater** is a supporting service for the protocol’s market-awareness layer.

It aggregates and normalizes pricing inputs from external or protocol-relevant sources, then publishes updates through the system’s expected integration points. Its role is to help keep risk evaluation and liquidation logic grounded in timely market data.

---

## Architectural Principles

### Clear separation between logic and runtime

The repository follows a **ports-and-adapters / hexagonal architecture** approach.

Core services are written to focus on business logic and application flow. Runtime-specific concerns such as Lambda handlers, container entrypoints, and AWS event translation are kept in adapter layers. This improves testability, keeps service logic easier to reason about, and reduces coupling between protocol logic and cloud delivery mechanisms.

### Queue-safe asynchronous processing

The backend is designed around durable asynchronous boundaries. That means duplicate delivery, delayed execution, and temporary backlogs are treated as normal operating conditions rather than exceptional cases.

As a result, services are built around patterns such as:

- safe revalidation before execution,
- explicit queue handoff boundaries,
- narrow units of work,
- observable backlog rather than hidden pressure.

### Blockchain remains the source of truth

Like the infrastructure platform that runs these services, this application layer treats the **Radix ledger** as the authoritative source of truth.

Off-chain state, caches, and derived artifacts exist to improve operational efficiency and execution speed, not to replace the protocol’s canonical state.

### Pragmatic cloud alignment

The service layer is intentionally shaped to fit the workload characteristics of the underlying AWS platform:

- lightweight orchestration maps well to Lambda,
- queue-driven variable-duration processing maps well to ECS workers,
- isolated execution maps well to event-triggered serverless functions,
- batch-derived outputs map well to durable object storage.

The result is a backend that is easier to operate and easier to reason about under stress.

---

## Technology Stack

The codebase uses a modern TypeScript monorepo toolchain designed for fast iteration and consistent builds.

- **Language:** TypeScript
- **Runtime and package manager:** Bun
- **Monorepo orchestration:** Turborepo
- **Bundling:** tsup
- **Cloud runtime targets:** AWS Lambda and Amazon ECS
- **Messaging and storage integration:** SQS, S3, and related AWS services
- **Testing:** `bun:test`

The choice of Bun and Turborepo helps keep local development and CI feedback fast, while the repository structure keeps boundaries explicit as the codebase grows.

---

## Getting Started Locally

### Prerequisites

Install the required local tooling:

- [Bun](https://bun.sh/)
- Docker, if you want to build or run containerized workers locally

### Install dependencies

```bash
bun install
```

### Run tests

```bash
bun run turbo test
```

### Build the monorepo

```bash
bun run turbo bundle
```

### Build a containerized worker locally

```bash
docker build -f aws-wrappers/indexer-container/Dockerfile -t weft-indexer:local .
```

---

## Relationship to the Infrastructure Repository

This repository is designed to be read alongside the infrastructure repository.

The infrastructure repository explains how the platform is provisioned and operated in AWS. This repository explains what the backend services actually do once that platform is running.

That split is intentional and useful:

* the infrastructure repo demonstrates **Infrastructure as Code**, deployment safety, observability, and runtime topology,
* this repo demonstrates **application architecture**, workload decomposition, protocol execution logic, and service-level engineering decisions.

---

## Why This Project Matters

This repository is more than a collection of backend jobs. It is a concrete example of designing application services for a time-sensitive financial system.

It demonstrates the ability to:

* translate protocol requirements into maintainable backend services,
* define clear boundaries between orchestration, processing, and execution,
* structure a monorepo for scalability and code reuse,
* keep core logic decoupled from cloud runtime specifics,
* design services that remain safe and understandable in asynchronous, failure-prone environments.

---

## Engineering Highlights

* **Backend architecture:** separated orchestration, processing, execution, and supporting market-data concerns into distinct services
* **Monorepo design:** organized shared packages, core services, and AWS adapters with explicit boundaries
* **Runtime decoupling:** kept business logic separate from Lambda and ECS entrypoints
* **Asynchronous correctness:** designed around queue-safe patterns, revalidation, and narrow units of work
* **Operational fit:** aligned service design with cost-aware AWS execution models
* **Developer experience:** used Bun, Turborepo, and shared internal packages to keep builds and iteration fast

---

## Future Improvements

Near-term improvements include stronger replay tooling, better failure classification around upstream dependency issues, and richer execution tracing across service boundaries.

Longer term, the service layer can support more advanced historical analysis, deeper simulation workflows, and broader automation around protocol operations as the platform evolves.
