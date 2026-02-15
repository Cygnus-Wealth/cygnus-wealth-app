# CygnusWealth App — Architecture

## E2E Testing Strategy

### Overview

End-to-end tests use [Playwright](https://playwright.dev/) to validate critical user flows against a live dev server running in **testnet mode** (`VITE_NETWORK_ENV=testnet`). All E2E tests live under `e2e/` and are excluded from the Vitest unit-test runner.

### Enterprise-Defined Scenarios

Tests are organised around the priority scenarios defined by the enterprise E2E strategy.

| Category | Scenario | Priority | Test File |
|---|---|---|---|
| Wallet Connection | Detect + connect wallet | P0 | `wallet-connection.spec.ts` |
| Wallet Connection | View wallet details | P0 | `wallet-connection.spec.ts` |
| Wallet Connection | Disconnect wallet | P0 | `wallet-connection.spec.ts` |
| Portfolio Display | Display portfolio value | P0 | `wallet-connection.spec.ts` |
| Portfolio Display | Asset listing | P1 | `wallet-connection.spec.ts` |
| Portfolio Display | Zero-balance filtering | P1 | `wallet-connection.spec.ts` |
| Environment | Testnet banner visible | P0 | `ci-safety-gate.spec.ts`, `testnet-wallet-connect.spec.ts` |
| Environment | Environment indicator badge | P1 | `ci-safety-gate.spec.ts`, `testnet-wallet-connect.spec.ts` |
| Error Handling | Connection failure | P1 | `error-handling.spec.ts` |
| Error Handling | Portfolio load failure | P1 | `error-handling.spec.ts` |
| Privacy | No external network calls | P0 | `ci-safety-gate.spec.ts` |

### Playwright Configuration

The configuration in `playwright.config.ts` follows enterprise standards:

- **Browsers**: Chromium and Firefox
- **CI execution**: Sequential (`workers: 1`), 2 retries, `forbidOnly` enforced
- **Local execution**: Parallel, 0 retries
- **Reporter**: HTML
- **Artifacts**: Trace on first retry, screenshots on failure only
- **Dev server**: Auto-starts `npm run dev` on port 5173 with `VITE_NETWORK_ENV=testnet`

### Mocking Strategy

Shared mock helpers are exported from `e2e/fixtures.ts`:

| Helper | Purpose |
|---|---|
| `mockEthereumProvider(page)` | Injects `window.ethereum` mimicking MetaMask on Ethereum mainnet (`0x1`) |
| `mockTestnetProvider(page)` | Injects `window.ethereum` on Sepolia testnet (`0xaa36a7`) |
| `mockFailingEthereumProvider(page)` | Injects a provider that rejects `eth_requestAccounts` (simulates user rejection) |
| `seedTestWallet(page)` | Seeds a connected testnet wallet into Zustand-persisted `localStorage` |
| `seedPortfolioState(page)` | Seeds wallet + assets + portfolio value via `localStorage` |
| `seedErrorState(page)` | Seeds a wallet in error state to test failure UI |

All mocks are injected via `page.addInitScript()` (runs before any page script) or `page.evaluate()` (for mid-test state changes via `window.__zustand_store`).

### Running Tests

```bash
npm run test:e2e          # Run all E2E tests (headless)
npm run test:e2e:ui       # Playwright UI mode (interactive)
npm run test:e2e:debug    # Debug mode with inspector
```

### Test File Organisation

```
e2e/
├── fixtures.ts                    # Shared mock helpers
├── ci-safety-gate.spec.ts         # CI safety: testnet enforcement, no production RPCs
├── wallet-connection.spec.ts      # Wallet connect/disconnect/details + portfolio display
├── testnet-wallet-connect.spec.ts # Wallet flows on testnet specifically
├── testnet-portfolio-sync.spec.ts # Testnet persistence and data isolation
├── error-handling.spec.ts         # Connection failure + portfolio load failure
└── portfolio-flow.spec.ts         # Navigation, empty state, mobile menu, accessibility
```

### Conventions

1. Use `data-testid` attributes for test-critical selectors (e.g. `testnet-banner`, `environment-indicator`).
2. Extract reusable mock logic into `e2e/fixtures.ts` rather than duplicating in each test file.
3. Seed Zustand state via environment-namespaced localStorage keys (`cygnus-wealth-storage-testnet`).
4. Never call production RPC endpoints during E2E runs — the CI safety gate enforces this.
5. Keep E2E tests focused on user-visible behaviour, not implementation details.
