(define-constant ERR-NOT-AUTHORIZED u200)
(define-constant ERR-INVALID-AMOUNT u201)
(define-constant ERR-INSUFFICIENT-BALANCE u202)
(define-constant ERR-INVALID-ALLOCATE u203)
(define-constant ERR-INVALID-MANAGER u204)
(define-constant ERR-INVALID-NAV u205)
(define-constant ERR-INVALID-SHARE u206)
(define-constant ERR-INVALID-WITHDRAWAL u207)
(define-constant ERR-GOVERNANCE-NOT-APPROVED u208)
(define-constant ERR-ORACLE-NOT-VERIFIED u209)
(define-constant ERR-ASSET-NOT-VALID u210)
(define-constant ERR-YIELD-NOT-ACCRUED u211)
(define-constant ERR-MAX-INVESTMENT u212)
(define-constant ERR-MIN-INVESTMENT u213)
(define-constant ERR-INVALID-TIMESTAMP u214)
(define-constant ERR-LOCKED-FUNDS u215)
(define-constant ERR-SLIPPAGE-EXCEEDED u216)
(define-constant ERR-INVALID-ASSET-CONTRACT u217)
(define-constant ERR-INSUFFICIENT-LIQUIDITY u218)
(define-constant ERR-INVALID-YIELD-RATE u219)
(define-constant ERR-CLAIM-COOLDOWN u220)
(define-constant ERR-INVALID-USER u221)

(define-fungible-token fund-share u100000000000000)
(define-data-var total-nav uint u0)
(define-data-var total-shares uint u0)
(define-data-var manager principal tx-sender)
(define-data-var governance-contract (optional principal) none)
(define-data-var oracle-contract (optional principal) none)
(define-data-var min-investment uint u1000000)
(define-data-var max-investment uint u1000000000)
(define-data-var withdrawal-lock uint u144)
(define-data-var yield-rate uint u5)
(define-data-var slippage-tolerance uint u100)
(define-data-var next-claim-id uint u0)
(define-map user-shares principal uint)
(define-map user-claims principal { last-claim: uint, claimed: uint })
(define-map allocations
  uint
  {
    asset-contract: principal,
    amount: uint,
    timestamp: uint,
    approved-by: principal
  }
)
(define-map assets
  principal
  {
    token-type: (string-ascii 50),
    value-per-token: uint,
    verified: bool
  }
)

(define-read-only (get-nav)
  (var-get total-nav)
)

(define-read-only (get-user-shares (user principal))
  (default-to u0 (map-get? user-shares user))
)

(define-read-only (get-user-claims (user principal))
  (map-get? user-claims user)
)

(define-read-only (get-allocation (id uint))
  (map-get? allocations id)
)

(define-read-only (get-asset (contract principal))
  (map-get? assets contract)
)

(define-read-only (calculate-shares (amount uint) (nav uint) (total-shares uint))
  (if (is-eq total-shares u0)
      (* amount u1000000)
      (/ (* amount total-shares) nav)
  )
)

(define-read-only (calculate-payout (shares uint) (nav uint) (total-shares uint))
  (/ (* shares nav) total-shares)
)

(define-read-only (calculate-yield (shares uint) (rate uint))
  (* shares (/ rate u100))
)

(define-read-only (is-governance-approved (caller principal))
  (match (var-get governance-contract)
    some-gov (contract-call? .governance-dao is-approved caller)
    false
  )
)

(define-read-only (is-oracle-verified (data (buff 64)))
  (match (var-get oracle-contract)
    some-oracle (contract-call? .oracle-verifier validate-proof data)
    false
  )
)

(define-private (validate-amount (amount uint))
  (if (and (>= amount (var-get min-investment)) (<= amount (var-get max-investment)))
      (ok true)
      (if (< amount (var-get min-investment))
          (err ERR-MIN-INVESTMENT)
          (err ERR-MAX-INVESTMENT)
      )
  )
)

(define-private (validate-shares (shares uint))
  (if (> shares u0)
      (ok true)
      (err ERR-INVALID-SHARE)
  )
)

(define-private (validate-nav (nav uint))
  (if (>= nav u0)
      (ok true)
      (err ERR-INVALID-NAV)
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP)
  )
)

(define-private (validate-slippage (expected uint) (actual uint))
  (let ((diff (abs (- expected actual))))
    (if (<= diff (var-get slippage-tolerance))
        (ok true)
        (err ERR-SLIPPAGE-EXCEEDED)
    )
  )
)

(define-private (validate-asset-contract (contract principal))
  (match (map-get? assets contract)
    some-asset (if (get verified some-asset)
                   (ok true)
                   (err ERR-ASSET-NOT-VALID)
    )
    (err ERR-INVALID-ASSET-CONTRACT)
  )
)

(define-private (validate-withdrawal-lock (user principal))
  (match (map-get? user-claims user)
    some-claim (if (>= block-height (+ (get last-claim some-claim) (var-get withdrawal-lock)))
                   (ok true)
                   (err ERR-LOCKED-FUNDS)
    )
    (ok true)
  )
)

(define-private (validate-yield-accrual (user principal))
  (match (map-get? user-claims user)
    some-claim (if (> block-height (get last-claim some-claim))
                   (ok true)
                   (err ERR-YIELD-NOT-ACCRUED)
    )
    (ok true)
  )
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED)
  )
)

(define-public (set-governance-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get governance-contract)) (err ERR-GOVERNANCE-NOT-APPROVED))
    (var-set governance-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-oracle-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get oracle-contract)) (err ERR-ORACLE-NOT-VERIFIED))
    (var-set oracle-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-min-investment (new-min uint))
  (begin
    (asserts! (is-some (var-get governance-contract)) (err ERR-GOVERNANCE-NOT-APPROVED))
    (asserts! (> new-min u0) (err ERR-INVALID-AMOUNT))
    (var-set min-investment new-min)
    (ok true)
  )
)

(define-public (set-max-investment (new-max uint))
  (begin
    (asserts! (is-some (var-get governance-contract)) (err ERR-GOVERNANCE-NOT-APPROVED))
    (asserts! (> new-max u0) (err ERR-INVALID-AMOUNT))
    (var-set max-investment new-max)
    (ok true)
  )
)

(define-public (set-yield-rate (new-rate uint))
  (begin
    (asserts! (is-some (var-get governance-contract)) (err ERR-GOVERNANCE-NOT-APPROVED))
    (asserts! (<= new-rate u20) (err ERR-INVALID-YIELD-RATE))
    (var-set yield-rate new-rate)
    (ok true)
  )
)

(define-public (set-manager (new-manager principal))
  (begin
    (asserts! (is-some (var-get governance-contract)) (err ERR-GOVERNANCE-NOT-APPROVED))
    (var-set manager new-manager)
    (ok true)
  )
)

(define-public (invest (amount uint))
  (let ((caller tx-sender)
        (nav (var-get total-nav))
        (total-shares (var-get total-shares))
        (new-shares (calculate-shares amount nav total-shares)))
    (try! (validate-amount amount))
    (try! (validate-nav nav))
    (try! (stx-transfer? amount caller (as-contract tx-sender)))
    (try! (ft-mint? fund-share new-shares caller))
    (map-set user-shares caller (+ (default-to u0 (map-get? user-shares caller)) new-shares))
    (var-set total-nav (+ nav amount))
    (var-set total-shares (+ total-shares new-shares))
    (ok new-shares)
  )
)

(define-public (withdraw (shares uint))
  (let ((caller tx-sender)
        (nav (var-get total-nav))
        (total-shares (var-get total-shares))
        (user-balance (default-to u0 (map-get? user-shares caller)))
        (payout (calculate-payout shares nav total-shares))
        (yield (calculate-yield shares (var-get yield-rate))))
    (try! (validate-shares shares))
    (asserts! (>= user-balance shares) (err ERR-INSUFFICIENT-BALANCE))
    (try! (validate-withdrawal-lock caller))
    (try! (ft-burn? fund-share shares caller))
    (try! (as-contract (stx-transfer? (+ payout yield) tx-sender caller)))
    (map-set user-shares caller (- user-balance shares))
    (var-set total-nav (- nav (+ payout yield)))
    (var-set total-shares (- total-shares shares))
    (map-set user-claims caller
      {
        last-claim: block-height,
        claimed: (+ (default-to u0 (get claimed (unwrap! (map-get? user-claims caller) (default-to { last-claim: u0, claimed: u0 })))) yield)
      }
    )
    (ok (+ payout yield))
  )
)

(define-public (allocate-funds (asset-contract principal) (amount uint))
  (let ((caller tx-sender)
        (next-id (var-get next-claim-id))
        (nav (var-get total-nav)))
    (asserts! (or (is-eq caller (var-get manager)) (is-governance-approved caller)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-asset-contract asset-contract))
    (asserts! (<= amount nav) (err ERR-INVALID-ALLOCATE))
    (try! (as-contract (contract-call? .green-asset-token transfer amount tx-sender asset-contract none)))
    (map-set allocations next-id
      {
        asset-contract: asset-contract,
        amount: amount,
        timestamp: block-height,
        approved-by: caller
      }
    )
    (var-set next-claim-id (+ next-id u1))
    (var-set total-nav (- nav amount))
    (ok true)
  )
)

(define-public (claim-yield (user principal))
  (let ((caller tx-sender)
        (user-claim (default-to { last-claim: u0, claimed: u0 } (map-get? user-claims user))))
    (try! (validate-yield-accrual user))
    (asserts! (is-eq caller user) (err ERR-INVALID-USER))
    (let ((new-claim (calculate-yield (get-user-shares user) (var-get yield-rate))))
      (try! (as-contract (stx-transfer? new-claim tx-sender caller)))
      (map-set user-claims user
        {
          last-claim: block-height,
          claimed: (+ (get claimed user-claim) new-claim)
        }
      )
      (ok new-claim)
    )
  )
)

(define-public (update-nav (new-nav uint) (proof (buff 64)))
  (begin
    (asserts! (is-some (var-get oracle-contract)) (err ERR-ORACLE-NOT-VERIFIED))
    (try! (is-oracle-verified proof))
    (try! (validate-nav new-nav))
    (var-set total-nav new-nav)
    (ok true)
  )
)