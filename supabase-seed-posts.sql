-- ============================================================
-- Seed: test projects + static demo posts
-- Run in Supabase SQL Editor after supabase-zxp-schema.sql
-- ============================================================

-- 1. Insert test projects (skip if they already exist by slug)
INSERT INTO projects (name, slug, category, description, trust_score, is_verified)
VALUES
  ('NovaDEX',       'novadex',       'DEX',     'Decentralized exchange on Base Mainnet',        41, true),
  ('BaseSwap Pro',  'baseswap-pro',  'DEX',     'Advanced AMM DEX on Base Mainnet',             63, true),
  ('Umia Protocol', 'umia-protocol', 'DeFi',    'Yield optimizer on Base Mainnet',              72, true),
  ('ZeroLend',      'zerolend',      'Lending', 'Non-custodial lending protocol on Base',        75, true),
  ('AeroBase',      'aerobase',      'AMM',     'Concentrated liquidity AMM on Base Mainnet',   85, true)
ON CONFLICT (slug) DO UPDATE SET
  trust_score  = EXCLUDED.trust_score,
  is_verified  = EXCLUDED.is_verified,
  description  = COALESCE(projects.description, EXCLUDED.description);

-- 2. Helper: resolve project ID by slug
-- We use a DO block so we can reference IDs dynamically

DO $$
DECLARE
  p_novadex       UUID;
  p_baseswap      UUID;
  p_umia          UUID;
  p_zerolend      UUID;
  p_aerobase      UUID;
  system_wallet   TEXT := '0x0000000000000000000000000000000000000001';
BEGIN
  SELECT id INTO p_novadex   FROM projects WHERE slug = 'novadex'       LIMIT 1;
  SELECT id INTO p_baseswap  FROM projects WHERE slug = 'baseswap-pro'  LIMIT 1;
  SELECT id INTO p_umia      FROM projects WHERE slug = 'umia-protocol' LIMIT 1;
  SELECT id INTO p_zerolend  FROM projects WHERE slug = 'zerolend'      LIMIT 1;
  SELECT id INTO p_aerobase  FROM projects WHERE slug = 'aerobase'      LIMIT 1;

  -- NovaDEX — alert
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_novadex, system_wallet, 'alert',
    'Deadline missed — no response for 48h',
    'The project did not confirm the Liquidity Pool v2 milestone. Trust Score was reduced automatically.

NovaDEX failed to respond to the LP v2 milestone confirmation request within the 48-hour governance window. Per Zexus protocol rules, an automated trust penalty was applied. The team has been notified via on-chain message and has until block #8,452,100 to respond before an Emergency Call can be initiated by any verified holder.',
    -18,
    NOW() - INTERVAL '10 minutes'
  ) ON CONFLICT DO NOTHING;

  -- BaseSwap Pro — voting (stored as update since voting is not a DB post_type)
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_baseswap, system_wallet, 'verdict',
    'Certik Security Audit — community vote passed',
    'Audit completed, 2 minor issues found and fixed before deploy. Community voted 74% in favour.

BaseSwap Pro has completed a full Certik security audit of the v3 AMM contracts. The audit identified 2 minor informational issues, both of which were patched prior to deployment. The final report is publicly available on Certik''s website. This community vote formally ratifies the audit result.',
    8,
    NOW() - INTERVAL '5 hours'
  ) ON CONFLICT DO NOTHING;

  -- Umia Protocol — verdict
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_umia, system_wallet, 'verdict',
    'Testnet deploy — confirmed by the community ✓',
    '847 verified holders took part in the vote. Result accepted.

Umia Protocol''s testnet deployment of the v2 yield optimizer has been formally verified by 847 holder participants on Zexus. The milestone included a public testnet, a 72-hour bug bounty period with no critical findings, and a Halborn security review. Trust Score increased by 12 points.',
    12,
    NOW() - INTERVAL '2 hours'
  ) ON CONFLICT DO NOTHING;

  -- AeroBase — update
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_aerobase, system_wallet, 'update',
    'v2.1 mainnet deploy completed',
    'New protocol with improved UI and 18% lower gas. Mainnet live.

AeroBase v2.1 is now live on Base Mainnet. Key improvements include a redesigned liquidity UI, 18% average gas reduction through calldata optimizations, MEV protection on all swaps via a custom mempool guard, and support for concentrated liquidity positions. TVL migrated from v2.0 within 6 hours of launch with zero incidents.',
    0,
    NOW() - INTERVAL '8 hours'
  ) ON CONFLICT DO NOTHING;

  -- ZeroLend — update (new project announcement)
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_zerolend, system_wallet, 'update',
    'ZeroLend joined Zexus — Genesis Tier 2',
    'Lending protocol verified. Verify your holding to join future verdicts.

ZeroLend, a non-custodial lending protocol with $140M TVL across chains, has joined the Zexus governance layer at Genesis Tier 2. Verified ZRLND token holders on Base Mainnet are eligible to participate in the first milestone vote launching in 7 days. The protocol has committed to publishing quarterly on-chain governance reports via Zexus.',
    0,
    NOW() - INTERVAL '1 day'
  ) ON CONFLICT DO NOTHING;

  -- BaseSwap Pro — alert (reentrancy)
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_baseswap, system_wallet, 'alert',
    'Community flagged low-severity contract issue',
    'A community researcher identified a reentrancy edge case in the LP router. Team acknowledged and patch is in review — funds not at risk.

Security researcher @chainwatch identified a theoretical reentrancy path in the BaseSwap Pro LP router. The attack vector requires controlling a malicious token contract, limiting real-world risk. Team acknowledged within 2 hours and a patch is under review.',
    -5,
    NOW() - INTERVAL '3 hours'
  ) ON CONFLICT DO NOTHING;

  -- AeroBase — verdict (fee reduction)
  INSERT INTO posts (project_id, author_wallet, post_type, title, content, trust_score_change, created_at)
  VALUES (
    p_aerobase, system_wallet, 'verdict',
    'Fee reduction proposal — passed 91% ✓',
    'Governance vote to cut swap fees from 0.3% to 0.2% passed by a decisive majority. Change goes live in the next deploy.

The AeroBase fee reduction proposal (AIP-07) has passed with 91% approval from 1,204 holders. Swap fees will be reduced from 0.3% to 0.2% in the next contract upgrade. The proposal estimated that lower fees will increase volume by 35-50%, resulting in equivalent or higher LP revenue.',
    8,
    NOW() - INTERVAL '6 hours'
  ) ON CONFLICT DO NOTHING;

END $$;

-- 3. Allow the system wallet in posts (bypass admin_wallet check for seeded posts)
-- The posts are inserted directly so the API check doesn't apply.
-- If projects.admin_wallet check is required, set it for the system wallet:
UPDATE projects SET admin_wallet = '0x0000000000000000000000000000000000000001'
WHERE slug IN ('novadex', 'baseswap-pro', 'umia-protocol', 'zerolend')
  AND (admin_wallet IS NULL OR admin_wallet = '');
