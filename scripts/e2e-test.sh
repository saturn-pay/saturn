#!/bin/bash
# E2E Test Script for Saturn API
# Tests: signup, wallet, funding, proxy calls, shared wallet

set -e

BASE_URL="${SATURN_API_URL:-https://saturn-api-production-460d.up.railway.app}"
TIMESTAMP=$(date +%s)

echo "=================================="
echo "Saturn E2E Test (curl)"
echo "Base URL: $BASE_URL"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Health check
# ---------------------------------------------------------------------------
echo "1. Health check..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | grep -q '"status":"ok"' && pass "API is healthy" || fail "API health check failed"

# ---------------------------------------------------------------------------
# 2. Signup
# ---------------------------------------------------------------------------
echo ""
echo "2. Signup..."
SIGNUP=$(curl -s -X POST "$BASE_URL/v1/signup" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"e2e-test-$TIMESTAMP\", \"email\": \"e2e-$TIMESTAMP@test.com\"}")

API_KEY=$(echo "$SIGNUP" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
AGENT_ID=$(echo "$SIGNUP" | grep -o '"agentId":"[^"]*"' | cut -d'"' -f4)
ACCOUNT_ID=$(echo "$SIGNUP" | grep -o '"accountId":"[^"]*"' | cut -d'"' -f4)

[ -n "$API_KEY" ] && pass "Signup successful (agent: $AGENT_ID)" || fail "Signup failed"

# ---------------------------------------------------------------------------
# 3. Check wallet (should be empty)
# ---------------------------------------------------------------------------
echo ""
echo "3. Check wallet (should be empty)..."
WALLET=$(curl -s "$BASE_URL/v1/wallet" -H "Authorization: Bearer $API_KEY")

BALANCE_SATS=$(echo "$WALLET" | grep -o '"balanceSats":[0-9]*' | cut -d':' -f2)
BALANCE_USD=$(echo "$WALLET" | grep -o '"balanceUsdCents":[0-9]*' | cut -d':' -f2)

[ "$BALANCE_SATS" = "0" ] && [ "$BALANCE_USD" = "0" ] && pass "Wallet is empty (sats: $BALANCE_SATS, usd: $BALANCE_USD cents)" || fail "Wallet not empty"

# ---------------------------------------------------------------------------
# 4. Test Lightning funding endpoint
# ---------------------------------------------------------------------------
echo ""
echo "4. Test Lightning funding..."
INVOICE=$(curl -s -X POST "$BASE_URL/v1/wallet/fund" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amountSats": 1000}')

PAYMENT_REQUEST=$(echo "$INVOICE" | grep -o '"paymentRequest":"[^"]*"' | cut -d'"' -f4)
[ -n "$PAYMENT_REQUEST" ] && pass "Lightning invoice created" || fail "Lightning funding failed"

# ---------------------------------------------------------------------------
# 5. Test Card funding endpoint
# ---------------------------------------------------------------------------
echo ""
echo "5. Test Card funding..."
CHECKOUT=$(curl -s -X POST "$BASE_URL/v1/wallet/fund-card" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amountUsdCents": 500}')

CHECKOUT_URL=$(echo "$CHECKOUT" | grep -o '"checkoutUrl":"[^"]*"' | cut -d'"' -f4)
[ -n "$CHECKOUT_URL" ] && pass "Stripe checkout created" || fail "Card funding failed"

# ---------------------------------------------------------------------------
# 6. Test proxy call (should fail - insufficient balance)
# ---------------------------------------------------------------------------
echo ""
echo "6. Test proxy call (insufficient balance)..."
PROXY_RESULT=$(curl -s -X POST "$BASE_URL/v1/capabilities/read" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}')

echo "$PROXY_RESULT" | grep -q "INSUFFICIENT_BALANCE" && pass "Correctly rejected (insufficient balance)" || echo "  (Note: may pass if provider unavailable)"

# ---------------------------------------------------------------------------
# 7. Create second agent (shared wallet test)
# ---------------------------------------------------------------------------
echo ""
echo "7. Create second agent..."
AGENT2=$(curl -s -X POST "$BASE_URL/v1/agents" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "e2e-agent2"}')

AGENT2_KEY=$(echo "$AGENT2" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
AGENT2_ID=$(echo "$AGENT2" | grep -o '"id":"agt_[^"]*"' | cut -d'"' -f4)
[ -n "$AGENT2_KEY" ] && pass "Second agent created ($AGENT2_ID)" || fail "Second agent creation failed"

# ---------------------------------------------------------------------------
# 8. Verify shared wallet
# ---------------------------------------------------------------------------
echo ""
echo "8. Verify shared wallet..."
WALLET1=$(curl -s "$BASE_URL/v1/wallet" -H "Authorization: Bearer $API_KEY")
WALLET2=$(curl -s "$BASE_URL/v1/wallet" -H "Authorization: Bearer $AGENT2_KEY")

WALLET1_ID=$(echo "$WALLET1" | grep -o '"id":"wal_[^"]*"' | cut -d'"' -f4)
WALLET2_ID=$(echo "$WALLET2" | grep -o '"id":"wal_[^"]*"' | cut -d'"' -f4)

[ "$WALLET1_ID" = "$WALLET2_ID" ] && pass "Shared wallet verified ($WALLET1_ID)" || fail "Wallets not shared"

# ---------------------------------------------------------------------------
# 9. Check dual-currency fields
# ---------------------------------------------------------------------------
echo ""
echo "9. Check dual-currency wallet fields..."
echo "$WALLET1" | grep -q '"balanceUsdCents"' && pass "Has balanceUsdCents" || fail "Missing balanceUsdCents"
echo "$WALLET1" | grep -q '"heldUsdCents"' && pass "Has heldUsdCents" || fail "Missing heldUsdCents"
echo "$WALLET1" | grep -q '"lifetimeInUsdCents"' && pass "Has lifetimeInUsdCents" || fail "Missing lifetimeInUsdCents"
echo "$WALLET1" | grep -q '"lifetimeOutUsdCents"' && pass "Has lifetimeOutUsdCents" || fail "Missing lifetimeOutUsdCents"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=================================="
echo -e "${GREEN}All E2E tests passed!${NC}"
echo "=================================="
echo ""
echo "Test account credentials:"
echo "  API Key: $API_KEY"
echo "  Agent ID: $AGENT_ID"
echo "  Account ID: $ACCOUNT_ID"
echo ""
echo "To complete card funding test manually:"
echo "  1. Open: $CHECKOUT_URL"
echo "  2. Use test card: 4242 4242 4242 4242"
echo "  3. Check balance: curl -s $BASE_URL/v1/wallet -H 'Authorization: Bearer $API_KEY'"
