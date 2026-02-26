# Domain Architecture: EIP-6963 Wallet Discovery UI Integration

**Directive**: en-7hfo (EIP-6963 Wallet Discovery Integration)
**Domain**: Experience (CygnusWealthApp)
**Date**: 2026-02-25
**Builds On**: en-o8w (Multi-Chain Wallet Unification), en-fr0z (Multi-Wallet Multi-Account Architecture)

---

## 1. Purpose

This document defines how CygnusWealthApp (Experience domain) integrates with WalletIntegrationSystem's (WIS) EIP-6963 discovery service. It specifies the data flow from WIS discovery into CWA's UI, the state management patterns for discovered wallets, the migration path from legacy `window.ethereum` detection, and guidance for System/BC Architecture implementation.

### Scope

- How `MultiWalletConnect` consumes `DiscoveredWallet[]` from WIS
- How wallet branding (`WalletProviderInfo`) flows into the UI
- How multi-chain wallets are presented (unified entries with chain family badges)
- Impact on Zustand store — wallet list source migration
- 3-phase migration plan per en-7hfo Section 6
- Backwards compatibility with existing `WalletConnection` entities
- Fallback icon handling for legacy-detected wallets
- Icon data sanitization (cross-domain security)

### Out of Scope

- WIS internal EIP-6963 implementation (Integration domain concern)
- Provider correlation logic (WIS-internal per en-o8w Section 4)
- Internal UI layout, animations, component design (System/Unit Architecture concern)
- Connection lifecycle changes (en-fr0z, unchanged)
- Portfolio data flow (PortfolioAggregation, unchanged)

---

## 2. Current State Assessment

### What Exists Today

CWA detects wallets via a hardcoded `WALLET_PROVIDERS` array in `MultiWalletConnect.tsx` (lines 38-114):

| Component | Problem |
|-----------|---------|
| `WALLET_PROVIDERS` array | Static list of 7 wallets with hardcoded names, icons (URLs/SVGs), and `check()` functions that probe `window.ethereum` boolean flags |
| `WalletProvider.check()` | Directly reads `window.ethereum.isMetaMask`, `.isRabby`, etc. — the provider collision problem en-7hfo describes |
| `WalletProvider.icon` | Mix of external URLs (MetaMask from Wikipedia, Rabby from rabby.io) and local SVG imports (Phantom, Slush) |
| `window.ethereum.providers` | Partial multi-provider detection via the deprecated `providers[]` array, but still flag-based |
| `src/types/global.d.ts` | TypeScript declarations for `EthereumProvider` with boolean property flags |
| `src/utils/walletManager.ts` | Singleton `WalletManager` from `@cygnus-wealth/wallet-integration-system` — used only for SUI connections currently |
| `src/store/useStore.ts` | `Account` interface with no concept of discovered (pre-connection) wallets |

### Key Gaps

1. **No discovery layer**: CWA has no concept of "discovered but not yet connected" wallets separate from connected accounts
2. **No WIS discovery consumption**: `WalletManager` is used only for SUI connections, not for wallet enumeration
3. **No branding data flow**: Wallet names and icons are hardcoded in CWA, not sourced from wallet extensions
4. **No discovery events**: CWA polls `window.ethereum` at render time rather than reacting to discovery events
5. **No multi-chain wallet unification in discovery**: Phantom appears as separate EVM and Solana entries

---

## 3. Target Architecture: Data Flow

### Discovery Data Flow

```
WIS Discovery Layer (Integration domain)
    │
    ├── Listens for eip6963:announceProvider events
    ├── Listens for Wallet Standard registrations
    ├── Probes window.ethereum as fallback
    ├── Correlates cross-chain providers (en-o8w)
    │
    ▼ (cross-domain boundary)
CWA Discovery State (Experience domain)
    │
    ├── useDiscoveredWallets() hook
    │     ├── Subscribes to WIS discovery events
    │     ├── Maintains DiscoveredWallet[] in Zustand
    │     └── Exposes discovery status (loading/settled/error)
    │
    ├── Wallet Selection UI
    │     ├── Renders DiscoveredWallet[] with provider-supplied branding
    │     ├── Shows chain family badges for multi-chain wallets
    │     └── Handles fallback icons for legacy-detected wallets
    │
    ▼ (user selects a wallet)
CWA Connect Flow (unchanged per en-fr0z)
    │
    ├── Requests connection via WIS (existing connect path)
    ├── Receives WalletConnection + ConnectedAccount[]
    └── Updates connected wallet state in Zustand store
```

### State Architecture

CWA introduces a new state concern: **discovered wallets** (pre-connection), distinct from **connected accounts** (post-connection).

```
Zustand Store
├── discoveredWallets: DiscoveredWallet[]     ← NEW: from WIS discovery
├── discoveryStatus: DiscoveryStatus          ← NEW: loading | settled | error
├── accounts: Account[]                       ← EXISTING: connected wallet accounts
└── ...existing state...
```

The `discoveredWallets` slice is:
- **Non-persisted**: Discovery results are ephemeral — wallets are re-discovered on each page load via EIP-6963 events
- **Reactive**: Updated in response to WIS discovery events (wallet announced, wallet removed, discovery settled)
- **Read-only from UI perspective**: CWA never modifies discovered wallets, only reads them for rendering

---

## 4. Domain Types at the Boundary

### Types CWA Consumes from WIS

These types cross the Integration → Experience boundary. CWA depends on them but does not define them.

**`DiscoveredWallet`** (defined by en-o8w, extended by en-7hfo):

| Field | Type | Description |
|-------|------|-------------|
| `walletProviderId` | `WalletProviderId` | Canonical wallet identifier (e.g., `'metamask'`, `'phantom'`) |
| `supportedChainFamilies` | `ChainFamily[]` | Which chain families this wallet supports |
| `isMultiChain` | `boolean` | `true` if wallet supports > 1 chain family |
| `providerInfo` | `WalletProviderInfo \| null` | EIP-6963 branding (null for legacy-detected wallets) |
| `discoverySource` | `DiscoverySource` | How this wallet was detected |

**`WalletProviderInfo`** (from EIP-6963, defined by en-7hfo):

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Human-readable wallet name from the extension |
| `icon` | `string` | Data URI (SVG or PNG) of wallet icon |
| `rdns` | `string` | Reverse DNS identifier (e.g., `io.metamask`) |
| `uuid` | `string` | Unique session identifier for this provider instance |

**`DiscoverySource`** (enum):

| Value | Meaning |
|-------|---------|
| `'eip6963'` | Detected via EIP-6963 announceProvider event |
| `'wallet-standard'` | Detected via Wallet Standard registration |
| `'legacy-injection'` | Detected via window.ethereum / window.solana probing |
| `'walletconnect-v2'` | Available via WalletConnect v2 |

**`DiscoveryStatus`** (enum):

| Value | Meaning |
|-------|---------|
| `'loading'` | Discovery in progress, wallets may still announce |
| `'settled'` | Discovery window elapsed, no further announcements expected |
| `'error'` | Discovery failed (WIS unavailable, permissions error) |

### Types CWA Defines Internally

**`WalletDisplayInfo`** — CWA-internal type combining discovery data with UI concerns:

| Field | Type | Source |
|-------|------|--------|
| `walletProviderId` | `WalletProviderId` | From `DiscoveredWallet` |
| `displayName` | `string` | From `WalletProviderInfo.name`, or fallback name |
| `displayIcon` | `string` | From `WalletProviderInfo.icon`, or fallback icon |
| `chainFamilyBadges` | `ChainFamily[]` | From `DiscoveredWallet.supportedChainFamilies` |
| `isConnected` | `boolean` | Cross-referenced with connected accounts |
| `isLegacyDetected` | `boolean` | `discoverySource === 'legacy-injection'` |

This is an Experience-domain mapping — it combines WIS discovery data with CWA-internal state (connection status). WIS knows nothing about `WalletDisplayInfo`.

---

## 5. State Management Patterns

### Discovery State Slice

A new Zustand slice for wallet discovery, separate from the existing `accounts` state:

**Slice responsibilities:**
- Hold `DiscoveredWallet[]` from WIS
- Track `DiscoveryStatus`
- Provide computed `WalletDisplayInfo[]` by cross-referencing with connected accounts
- Handle late-arriving wallet announcements (append to list, notify UI)
- Handle wallet removal events (remove from list)

**Slice characteristics:**
- **Not persisted**: Discovery is re-run on each page load; stale discovery data is worse than no data
- **Event-driven updates**: State changes in response to WIS events, not polling
- **Derived state**: `WalletDisplayInfo[]` is computed from `DiscoveredWallet[]` + `Account[]`, not stored separately

### Hook: `useDiscoveredWallets()`

Primary hook for components to access discovery state:

**Returns:**
- `wallets: WalletDisplayInfo[]` — discovered wallets with display information
- `status: DiscoveryStatus` — current discovery status
- `refresh: () => void` — trigger a new discovery round (wraps WIS `requestDiscoveryRefresh`)

**Behavior:**
- On mount: subscribes to WIS discovery events
- On WIS `walletDiscovered` event: adds wallet to state, recomputes display info
- On WIS `walletRemoved` event: removes wallet from state
- On WIS `discoverySettled` event: updates status to `'settled'`
- On unmount: unsubscribes from WIS events

### Integration with Existing Account State

The existing `accounts` array in `useStore` is NOT modified. Instead:

- `useDiscoveredWallets()` cross-references `DiscoveredWallet.walletProviderId` with `Account.metadata.connectionType` to determine `isConnected`
- When a user connects a discovered wallet, the existing `addAccount()` flow is unchanged
- The `WALLET_PROVIDERS` hardcoded array is replaced by the dynamic `DiscoveredWallet[]` from WIS

### Event Subscription Pattern

CWA subscribes to WIS discovery events through the `WalletManager` service boundary:

```
WalletManager (from @cygnus-wealth/wallet-integration-system)
    │
    ├── onWalletDiscovered(callback)    → CWA adds to discovered list
    ├── onWalletRemoved(callback)       → CWA removes from discovered list
    ├── onDiscoverySettled(callback)    → CWA marks discovery as settled
    ├── getDiscoveredWallets()          → CWA gets initial snapshot
    └── requestDiscoveryRefresh()       → CWA triggers re-discovery
```

Whether these are direct callback registrations, EventEmitter subscriptions, or another pattern is a System Architecture decision. Domain Architecture requires only that CWA can subscribe to these events through the existing `WalletManager` boundary.

---

## 6. Wallet Branding Strategy

### EIP-6963 Detected Wallets (Primary Path)

For wallets detected via EIP-6963:
- `displayName` = `WalletProviderInfo.name` (provider-supplied, no CWA override)
- `displayIcon` = `WalletProviderInfo.icon` (provider-supplied data URI)
- No fallback to hardcoded icons
- `rdns` used for stable identification across sessions

### Legacy-Detected Wallets (Fallback Path)

For wallets detected via `window.ethereum` fallback (lacking `WalletProviderInfo`):
- `displayName` = fallback from a minimal legacy name map (e.g., `isMetaMask` → "MetaMask")
- `displayIcon` = generic wallet icon OR minimal fallback icon set
- The fallback icon set is expected to be small and shrink over time
- As of 2026, all major wallets support EIP-6963 — this path is for edge cases

### Wallet Standard Detected Wallets

For wallets detected via Wallet Standard (Sui, Solana):
- Wallet Standard provides its own name and icon metadata
- WIS normalizes this into the same `WalletProviderInfo` shape (or a parallel branding structure)
- CWA treats all branding uniformly regardless of discovery source

### Fallback Icon Strategy

A minimal `LEGACY_WALLET_FALLBACK` map retained in CWA during Phase 1 and Phase 2:

| Key | Purpose |
|-----|---------|
| `'generic-evm'` | Default icon for any legacy-detected EVM wallet without specific branding |
| Known legacy identifiers | Minimal set for wallets that might appear via legacy detection (shrinks over time) |

This map is deleted in Phase 3 when the legacy wallet registry is fully removed.

---

## 7. Multi-Chain Wallet Presentation

Per en-o8w and en-7hfo Section 7, multi-chain wallets appear as a single entry with chain family badges.

### Presentation Rules

1. **One entry per wallet**: Phantom appears once, not as separate "Phantom (EVM)" and "Phantom (Solana)" entries
2. **Chain family badges**: Each wallet entry shows badges for its supported chain families (e.g., EVM + Solana for Phantom, EVM + Solana + SUI for Trust Wallet)
3. **Unified connect action**: Connecting a multi-chain wallet initiates connection across all supported chain families (per en-o8w connection flow)
4. **Discovery source is internal**: Users don't see "EIP-6963" or "Wallet Standard" labels — they see the wallet with its capabilities

### Chain Family Badge Data

Badges are derived from `DiscoveredWallet.supportedChainFamilies`. The UI renders a badge for each supported family. Badge design (icons, colors, layout) is a System/Unit Architecture concern.

### Sorting and Grouping

Wallet list ordering is an Experience-domain UI concern. Recommended strategy:
- Connected wallets first (if showing both connected and available)
- EIP-6963 detected wallets before legacy-detected wallets (better branding, more reliable)
- Alphabetical within each group

---

## 8. Icon Data Sanitization

Per en-7hfo Section 10, EIP-6963 icons are data URIs supplied by wallet extensions. They must be treated as untrusted content.

### Security Requirements

1. **Validate data URI format**: Icons must match `data:image/(svg+xml|png|jpeg);base64,...` pattern. Reject malformed URIs.
2. **SVG sanitization**: SVG data URIs may contain embedded scripts. Render SVGs in sandboxed contexts:
   - Use `<img>` tags with data URI `src` (browsers block script execution in `<img>`)
   - Do NOT inject SVG content directly into the DOM via `dangerouslySetInnerHTML` or similar
   - Do NOT use `<object>` or `<embed>` tags for SVG rendering
3. **Content Security Policy**: Ensure CSP headers (if any) allow `data:` scheme in `img-src`
4. **Size limits**: Reject icons exceeding a reasonable size threshold (e.g., 128KB) to prevent resource exhaustion

### Implementation Pattern

The icon sanitization logic belongs in a shared utility, not inline in components. It applies uniformly to all provider-supplied icons regardless of discovery source.

---

## 9. Migration Plan

### Phase 1: Dual-Path Discovery (No Breaking Changes)

**Goal**: CWA consumes WIS discovery alongside existing legacy detection. No user-visible changes to the wallet list — but the infrastructure is in place.

**Changes**:
1. Add discovery state slice to Zustand store (`discoveredWallets`, `discoveryStatus`)
2. Implement `useDiscoveredWallets()` hook consuming WIS discovery events
3. `MultiWalletConnect` continues to use `WALLET_PROVIDERS` array for rendering
4. Discovery results are logged/compared against `WALLET_PROVIDERS` for validation
5. No changes to persisted data, connection flow, or UI rendering

**Verification**:
- Discovery hook correctly receives `DiscoveredWallet[]` from WIS
- Discovery events (announced, removed, settled) trigger state updates
- No regression in existing wallet detection or connection

**Cross-domain impact**: None. WIS capabilities are consumed but not yet used for rendering.

### Phase 2: Primary EIP-6963 (Deprecate Legacy UI)

**Goal**: `MultiWalletConnect` renders wallets from WIS discovery instead of the hardcoded `WALLET_PROVIDERS` array.

**Changes**:
1. `MultiWalletConnect` switches from `WALLET_PROVIDERS` to `useDiscoveredWallets()` as its wallet list source
2. `WalletProvider` interface replaced by `WalletDisplayInfo`
3. Wallet icons rendered from `WalletProviderInfo.icon` data URIs (with sanitization)
4. `WALLET_PROVIDERS` array retained but unused (kept as reference during transition)
5. `window.ethereum` probing removed from CWA — WIS handles all detection
6. `eth()` helper and `EthereumProvider` boolean flag checks removed from `MultiWalletConnect`
7. `WalletProvider.check()` detection functions removed

**Verification**:
- All previously detected wallets still appear (via WIS discovery)
- Provider-supplied icons and names render correctly
- Multi-chain wallets appear as single entries with badges
- Connection flow unchanged (click wallet → connect via existing path)

**Cross-domain impact**: CWA now requires WIS discovery to function. If WIS discovery fails, CWA shows an empty wallet list with an error state.

### Phase 3: Remove Legacy Wallet Registry

**Goal**: Remove all hardcoded wallet metadata from CWA.

**Changes**:
1. Delete `WALLET_PROVIDERS` array entirely
2. Delete `WalletProvider` interface
3. Delete legacy fallback icon map (or reduce to single generic icon)
4. Delete `window.ethereum` type declarations from `global.d.ts` (CWA no longer reads them)
5. Delete Phantom and Slush SVG icon imports from `src/assets/`
6. All wallet branding comes exclusively from WIS discovery

**Verification**:
- No hardcoded wallet names or icons in CWA codebase
- New wallets auto-appear when installed (no CWA code changes needed)
- Generic fallback icon displays for any wallet lacking branding metadata

**Cross-domain impact**: CWA no longer needs code changes when new wallets are added. WIS discovery automatically surfaces new wallets with their own branding.

---

## 10. Backwards Compatibility

### Existing Saved Wallet Connections

- `WalletConnection` entities in persisted storage are unaffected
- Existing `Account` entries in Zustand store retain their current shape
- `Account.metadata.connectionType` continues to identify the wallet provider
- No migration of persisted data required

### Reconnection on Page Load

Current behavior: CWA probes `window.ethereum` flags to find known wallets, then reconnects.

Target behavior: CWA requests discovery from WIS, matches discovered wallets against persisted `WalletConnection` entries by `walletProviderId`, then reconnects.

The matching strategy:
1. On page load, WIS runs discovery and emits `DiscoveredWallet[]`
2. CWA matches `DiscoveredWallet.walletProviderId` against persisted `Account.metadata.connectionType`
3. Matched wallets are marked as "available for reconnection"
4. Auto-reconnection proceeds via existing connection flow

### Account.metadata Changes

During Phase 2, new `Account` entries gain additional metadata:
- `Account.metadata.rdns` — RDNS identifier from EIP-6963 (more reliable than `connectionType` string matching)
- `Account.metadata.discoverySource` — how the wallet was originally detected

These fields are additive — existing accounts without them continue to work.

---

## 11. Error States and Edge Cases

### WIS Discovery Unavailable

If `WalletManager` fails to initialize or discovery throws an error:
- `discoveryStatus` = `'error'`
- UI shows an informative message: "Unable to detect wallets. Please refresh or check browser extensions."
- No fallback to direct `window.ethereum` probing — CWA depends on WIS (per Phase 2+)

### No Wallets Detected

If WIS discovery completes with zero results:
- `discoveryStatus` = `'settled'`
- `discoveredWallets` = `[]`
- UI shows empty state: "No wallet extensions detected. Install a supported wallet to get started."
- Previously connected wallets still appear in the accounts list (persisted state) but cannot be reconnected

### Late Wallet Announcements

EIP-6963 is event-based — wallets may announce after initial page load:
- CWA's discovery hook handles `walletDiscovered` events after initial load
- New wallets appear in the list dynamically (React re-render on state change)
- If the user is already viewing the wallet selection UI, new wallets appear in real-time

### Extension Disabled/Removed Mid-Session

If a wallet extension is disabled while CWA is open:
- WIS emits `walletRemoved` event
- CWA removes the wallet from `discoveredWallets`
- If the wallet was connected, the connection enters a degraded state (handled by existing connection lifecycle per en-fr0z)

---

## 12. Testing Strategy

### Unit Test Coverage

| Area | Tests |
|------|-------|
| Discovery state slice | Wallet added/removed/settled transitions, empty state handling |
| `useDiscoveredWallets()` hook | Event subscription, unsubscription, refresh trigger |
| `WalletDisplayInfo` mapping | Provider info → display info conversion, fallback icon logic |
| Icon sanitization | Valid/invalid data URI formats, size limits, SVG vs PNG handling |
| Legacy fallback map | Known wallet identifiers map to correct fallback names |
| Cross-reference logic | `isConnected` derived correctly from account state |

### Integration Test Coverage

| Area | Tests |
|------|-------|
| WIS → CWA data flow | Mock WIS emitting discovery events, verify CWA state updates |
| Discovery → Connection flow | Select discovered wallet → trigger connection → verify account created |
| Reconnection matching | Persisted accounts matched against newly discovered wallets |

### E2E Test Coverage

| Scenario | Description |
|----------|-------------|
| Fresh install, no wallets | Empty discovery state, informative empty message |
| Single EVM wallet | MetaMask detected via EIP-6963, icon and name from provider |
| Multi-chain wallet | Phantom shows EVM + Solana badges, single entry |
| Connect from discovery | Click discovered wallet → connection succeeds → wallet shows as connected |
| Late announcement | Wallet appears after initial load |

---

## 13. Guidance for System/BC Architecture

This domain architecture establishes the patterns. System and Unit Architecture should address:

1. **WalletManager API surface**: Define the exact TypeScript API for subscribing to discovery events (callback registration, EventEmitter, rxjs Observable, or Zustand middleware)
2. **Discovery hook implementation**: Whether `useDiscoveredWallets()` is a single hook or decomposed into `useDiscovery()` + `useWalletDisplayInfo()`
3. **Component decomposition**: How `MultiWalletConnect` is refactored — replace in-place vs. new component alongside
4. **Icon rendering component**: Shared `<WalletIcon>` component with built-in sanitization
5. **Discovery timing**: When discovery subscription starts (app mount, wallet settings page mount, or lazy on first access)
6. **Zustand slice structure**: Whether discovery state lives in the existing `useStore` or in a dedicated `useDiscoveryStore`
7. **Migration feature flag**: Whether Phase 1/2 transition uses a feature flag or is deployed as a single change

---

## 14. Decision Log

| Decision | Rationale |
|----------|-----------|
| Discovery state is non-persisted | Stale discovery data causes ghost wallets; re-discovery on load is fast |
| Separate `discoveredWallets` from `accounts` | Different lifecycles: discovery is ephemeral, connections are persisted |
| `WalletDisplayInfo` as CWA-internal type | Decouples UI concerns from cross-domain contract types |
| SVG icons rendered via `<img>` tags | Prevents script execution from untrusted SVG content |
| Phase 2 removes `window.ethereum` probing from CWA | CWA should not bypass WIS — single source of discovery truth |
| Fallback icon strategy is minimal and shrinking | All supported wallets have EIP-6963/Wallet Standard; legacy is edge case |
| No changes to `Account` interface shape | Backwards compatible; new metadata fields are additive |
| Discovery errors show informative UI, not silent failure | Users need actionable feedback when wallets can't be detected |
