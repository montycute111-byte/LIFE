import { getCrateBoostMultipliers, getInstantJobTokenCount, maybeAwardCrate } from "./crates.js";
import { getEducationMultipliers, getEducationProgram, isEducationCompleted } from "./education.js";
import { pushLog } from "./gameState.js";
import { getPowerItemMultipliers } from "./powerItems.js";
import { trackQuestEvent } from "./quests/questEngine.js";
import { awardXp, getPlayerEffects, processStoreTimers } from "./store.js";

const JOB_XP_CLAIM_MULTIPLIER = 0.35;

export const JOBS = [
  {
    id: "street_flyers",
    name: "Street Flyers",
    durationMs: 15 * 1000,
    payout: 45,
    xp: 14,
    levelRequired: 1
  },
  {
    id: "data_entry",
    name: "Data Entry Shift",
    durationMs: 30 * 1000,
    payout: 120,
    xp: 28,
    levelRequired: 2
  },
  {
    id: "delivery_loop",
    name: "Delivery Loop",
    durationMs: 45 * 1000,
    payout: 260,
    xp: 52,
    levelRequired: 4
  },
  {
    id: "night_audit",
    name: "Night Audit",
    durationMs: 70 * 1000,
    payout: 520,
    xp: 95,
    levelRequired: 6
  },
  {
    id: "vault_consulting",
    name: "Vault Consulting",
    durationMs: 110 * 1000,
    payout: 1100,
    xp: 180,
    levelRequired: 9
  },
  {
    id: "asset_recovery",
    name: "Asset Recovery Ops",
    durationMs: 150 * 1000,
    payout: 1700,
    xp: 255,
    levelRequired: 12
  },
  {
    id: "compliance_sweep",
    name: "Compliance Sweep",
    durationMs: 195 * 1000,
    payout: 2550,
    xp: 360,
    levelRequired: 15
  },
  {
    id: "hedge_modeling",
    name: "Hedge Modeling",
    durationMs: 250 * 1000,
    payout: 3800,
    xp: 500,
    levelRequired: 18
  },
  {
    id: "risk_command",
    name: "Risk Command Center",
    durationMs: 320 * 1000,
    payout: 5600,
    xp: 700,
    levelRequired: 22
  },
  {
    id: "quant_pipeline",
    name: "Quant Pipeline Build",
    durationMs: 410 * 1000,
    payout: 8200,
    xp: 960,
    levelRequired: 27
  },
  {
    id: "sovereign_audit",
    name: "Sovereign Audit Contract",
    durationMs: 520 * 1000,
    payout: 12000,
    xp: 1300,
    levelRequired: 32
  },
  {
    id: "interbank_merger",
    name: "Interbank Merger Deal",
    durationMs: 660 * 1000,
    payout: 17500,
    xp: 1750,
    levelRequired: 38
  },
  {
    id: "global_reserve",
    name: "Global Reserve Strategy",
    durationMs: 840 * 1000,
    payout: 25000,
    xp: 2350,
    levelRequired: 45
  },
  {
    id: "liquidity_backstop",
    name: "Liquidity Backstop Plan",
    durationMs: 1020 * 1000,
    payout: 34000,
    xp: 3000,
    levelRequired: 52
  },
  {
    id: "macro_futures_grid",
    name: "Macro Futures Grid",
    durationMs: 1240 * 1000,
    payout: 46000,
    xp: 3850,
    levelRequired: 60
  },
  {
    id: "continental_clearing",
    name: "Continental Clearing Ops",
    durationMs: 1500 * 1000,
    payout: 62000,
    xp: 4850,
    levelRequired: 68
  },
  {
    id: "orbital_rebalance",
    name: "Orbital Reserve Rebalance",
    durationMs: 1800 * 1000,
    payout: 82000,
    xp: 6100,
    levelRequired: 76
  },
  {
    id: "mythic_treasury",
    name: "Mythic Treasury Directive",
    durationMs: 2160 * 1000,
    payout: 108000,
    xp: 7600,
    levelRequired: 85
  },
  {
    id: "hs_fintech_capstone",
    name: "HS FinTech Capstone Desk",
    durationMs: 2520 * 1000,
    payout: 185000,
    xp: 8600,
    levelRequired: 95,
    educationRequired: "hs"
  },
  {
    id: "alumni_private_ledger",
    name: "Alumni Private Ledger Ops",
    durationMs: 3000 * 1000,
    payout: 295000,
    xp: 10400,
    levelRequired: 108,
    educationRequired: "hs"
  },
  {
    id: "academy_global_settlement",
    name: "Academy Global Settlement",
    durationMs: 3540 * 1000,
    payout: 460000,
    xp: 12500,
    levelRequired: 122,
    educationRequired: "hs"
  },
  {
    id: "college_quant_arbitrage",
    name: "College Quant Arbitrage",
    durationMs: 4200 * 1000,
    payout: 760000,
    xp: 15200,
    levelRequired: 150,
    educationRequired: "college"
  },
  {
    id: "doctoral_sovereign_engine",
    name: "Doctoral Sovereign Yield Engine",
    durationMs: 4920 * 1000,
    payout: 1180000,
    xp: 18600,
    levelRequired: 170,
    educationRequired: "college"
  },
  {
    id: "ivy_fusion_derivatives",
    name: "Ivy Fusion Derivatives Desk",
    durationMs: 5760 * 1000,
    payout: 1820000,
    xp: 22600,
    levelRequired: 192,
    educationRequired: "college"
  },
  {
    id: "interstellar_endowment",
    name: "Interstellar Endowment Command",
    durationMs: 6720 * 1000,
    payout: 2740000,
    xp: 27200,
    levelRequired: 220,
    educationRequired: "college"
  },
  {
    id: "core_apex_clearance_01",
    name: "Core Apex Clearance 1",
    durationMs: 6900 * 1000,
    payout: 3200000,
    xp: 30000,
    levelRequired: 230
  },
  {
    id: "core_apex_clearance_02",
    name: "Core Apex Clearance 2",
    durationMs: 7200 * 1000,
    payout: 4200000,
    xp: 34000,
    levelRequired: 242
  },
  {
    id: "core_apex_clearance_03",
    name: "Core Apex Clearance 3",
    durationMs: 7500 * 1000,
    payout: 5600000,
    xp: 39000,
    levelRequired: 254
  },
  {
    id: "core_apex_clearance_04",
    name: "Core Apex Clearance 4",
    durationMs: 7800 * 1000,
    payout: 7400000,
    xp: 45000,
    levelRequired: 266
  },
  {
    id: "core_apex_clearance_05",
    name: "Core Apex Clearance 5",
    durationMs: 8100 * 1000,
    payout: 9800000,
    xp: 52000,
    levelRequired: 278
  },
  {
    id: "core_apex_clearance_06",
    name: "Core Apex Clearance 6",
    durationMs: 8400 * 1000,
    payout: 12800000,
    xp: 60000,
    levelRequired: 290
  },
  {
    id: "core_apex_clearance_07",
    name: "Core Apex Clearance 7",
    durationMs: 8700 * 1000,
    payout: 16800000,
    xp: 69000,
    levelRequired: 302
  },
  {
    id: "core_apex_clearance_08",
    name: "Core Apex Clearance 8",
    durationMs: 9000 * 1000,
    payout: 22000000,
    xp: 79000,
    levelRequired: 314
  },
  {
    id: "core_apex_clearance_09",
    name: "Core Apex Clearance 9",
    durationMs: 9300 * 1000,
    payout: 28500000,
    xp: 90000,
    levelRequired: 326
  },
  {
    id: "core_apex_clearance_10",
    name: "Core Apex Clearance 10",
    durationMs: 9600 * 1000,
    payout: 36500000,
    xp: 102000,
    levelRequired: 338
  },
  {
    id: "core_apex_clearance_11",
    name: "Core Apex Clearance 11",
    durationMs: 9900 * 1000,
    payout: 46500000,
    xp: 115000,
    levelRequired: 350
  },
  {
    id: "core_apex_clearance_12",
    name: "Core Apex Clearance 12",
    durationMs: 10200 * 1000,
    payout: 59000000,
    xp: 129000,
    levelRequired: 362
  },
  {
    id: "hs_master_finance_01",
    name: "HS Master Finance Lab 1",
    durationMs: 9000 * 1000,
    payout: 6200000,
    xp: 46000,
    levelRequired: 260,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_02",
    name: "HS Master Finance Lab 2",
    durationMs: 9300 * 1000,
    payout: 8100000,
    xp: 52000,
    levelRequired: 275,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_03",
    name: "HS Master Finance Lab 3",
    durationMs: 9600 * 1000,
    payout: 10600000,
    xp: 59000,
    levelRequired: 290,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_04",
    name: "HS Master Finance Lab 4",
    durationMs: 9900 * 1000,
    payout: 13800000,
    xp: 67000,
    levelRequired: 305,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_05",
    name: "HS Master Finance Lab 5",
    durationMs: 10200 * 1000,
    payout: 17900000,
    xp: 76000,
    levelRequired: 320,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_06",
    name: "HS Master Finance Lab 6",
    durationMs: 10500 * 1000,
    payout: 23100000,
    xp: 86000,
    levelRequired: 335,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_07",
    name: "HS Master Finance Lab 7",
    durationMs: 10800 * 1000,
    payout: 29600000,
    xp: 97000,
    levelRequired: 350,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_08",
    name: "HS Master Finance Lab 8",
    durationMs: 11100 * 1000,
    payout: 37800000,
    xp: 109000,
    levelRequired: 365,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_09",
    name: "HS Master Finance Lab 9",
    durationMs: 11400 * 1000,
    payout: 48000000,
    xp: 122000,
    levelRequired: 380,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_10",
    name: "HS Master Finance Lab 10",
    durationMs: 11700 * 1000,
    payout: 60700000,
    xp: 136000,
    levelRequired: 395,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_11",
    name: "HS Master Finance Lab 11",
    durationMs: 12000 * 1000,
    payout: 76500000,
    xp: 151000,
    levelRequired: 410,
    educationRequired: "hs"
  },
  {
    id: "hs_master_finance_12",
    name: "HS Master Finance Lab 12",
    durationMs: 12300 * 1000,
    payout: 96000000,
    xp: 167000,
    levelRequired: 425,
    educationRequired: "hs"
  },
  {
    id: "apex_treasury_01",
    name: "Apex Treasury Operation 1",
    durationMs: 7200 * 1000,
    payout: 3600000,
    xp: 32000,
    levelRequired: 240,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_02",
    name: "Apex Treasury Operation 2",
    durationMs: 7380 * 1000,
    payout: 3978000,
    xp: 35500,
    levelRequired: 245,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_03",
    name: "Apex Treasury Operation 3",
    durationMs: 7560 * 1000,
    payout: 4395690,
    xp: 39000,
    levelRequired: 250,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_04",
    name: "Apex Treasury Operation 4",
    durationMs: 7740 * 1000,
    payout: 4857237,
    xp: 42500,
    levelRequired: 255,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_05",
    name: "Apex Treasury Operation 5",
    durationMs: 7920 * 1000,
    payout: 5367247,
    xp: 46000,
    levelRequired: 260,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_06",
    name: "Apex Treasury Operation 6",
    durationMs: 8100 * 1000,
    payout: 5930808,
    xp: 49500,
    levelRequired: 265,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_07",
    name: "Apex Treasury Operation 7",
    durationMs: 8280 * 1000,
    payout: 6553543,
    xp: 53000,
    levelRequired: 270,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_08",
    name: "Apex Treasury Operation 8",
    durationMs: 8460 * 1000,
    payout: 7241665,
    xp: 56500,
    levelRequired: 275,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_09",
    name: "Apex Treasury Operation 9",
    durationMs: 8640 * 1000,
    payout: 8002040,
    xp: 60000,
    levelRequired: 280,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_10",
    name: "Apex Treasury Operation 10",
    durationMs: 8820 * 1000,
    payout: 8842254,
    xp: 63500,
    levelRequired: 285,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_11",
    name: "Apex Treasury Operation 11",
    durationMs: 9000 * 1000,
    payout: 9770691,
    xp: 67000,
    levelRequired: 290,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_12",
    name: "Apex Treasury Operation 12",
    durationMs: 9180 * 1000,
    payout: 10796614,
    xp: 70500,
    levelRequired: 295,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_13",
    name: "Apex Treasury Operation 13",
    durationMs: 9360 * 1000,
    payout: 11930258,
    xp: 74000,
    levelRequired: 300,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_14",
    name: "Apex Treasury Operation 14",
    durationMs: 9540 * 1000,
    payout: 13182935,
    xp: 77500,
    levelRequired: 305,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_15",
    name: "Apex Treasury Operation 15",
    durationMs: 9720 * 1000,
    payout: 14567143,
    xp: 81000,
    levelRequired: 310,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_16",
    name: "Apex Treasury Operation 16",
    durationMs: 9900 * 1000,
    payout: 16096693,
    xp: 84500,
    levelRequired: 315,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_17",
    name: "Apex Treasury Operation 17",
    durationMs: 10080 * 1000,
    payout: 17786846,
    xp: 88000,
    levelRequired: 320,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_18",
    name: "Apex Treasury Operation 18",
    durationMs: 10260 * 1000,
    payout: 19654465,
    xp: 91500,
    levelRequired: 325,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_19",
    name: "Apex Treasury Operation 19",
    durationMs: 10440 * 1000,
    payout: 21718184,
    xp: 95000,
    levelRequired: 330,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_20",
    name: "Apex Treasury Operation 20",
    durationMs: 10620 * 1000,
    payout: 23998593,
    xp: 98500,
    levelRequired: 335,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_21",
    name: "Apex Treasury Operation 21",
    durationMs: 10800 * 1000,
    payout: 26518445,
    xp: 102000,
    levelRequired: 340,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_22",
    name: "Apex Treasury Operation 22",
    durationMs: 10980 * 1000,
    payout: 29302882,
    xp: 105500,
    levelRequired: 345,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_23",
    name: "Apex Treasury Operation 23",
    durationMs: 11160 * 1000,
    payout: 32379685,
    xp: 109000,
    levelRequired: 350,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_24",
    name: "Apex Treasury Operation 24",
    durationMs: 11340 * 1000,
    payout: 35779552,
    xp: 112500,
    levelRequired: 355,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_25",
    name: "Apex Treasury Operation 25",
    durationMs: 11520 * 1000,
    payout: 39536405,
    xp: 116000,
    levelRequired: 360,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_26",
    name: "Apex Treasury Operation 26",
    durationMs: 11700 * 1000,
    payout: 43687727,
    xp: 119500,
    levelRequired: 365,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_27",
    name: "Apex Treasury Operation 27",
    durationMs: 11880 * 1000,
    payout: 48274939,
    xp: 123000,
    levelRequired: 370,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_28",
    name: "Apex Treasury Operation 28",
    durationMs: 12060 * 1000,
    payout: 53343807,
    xp: 126500,
    levelRequired: 375,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_29",
    name: "Apex Treasury Operation 29",
    durationMs: 12240 * 1000,
    payout: 58944907,
    xp: 130000,
    levelRequired: 380,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_30",
    name: "Apex Treasury Operation 30",
    durationMs: 12420 * 1000,
    payout: 65134122,
    xp: 133500,
    levelRequired: 385,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_31",
    name: "Apex Treasury Operation 31",
    durationMs: 12600 * 1000,
    payout: 71973205,
    xp: 137000,
    levelRequired: 390,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_32",
    name: "Apex Treasury Operation 32",
    durationMs: 12780 * 1000,
    payout: 79530391,
    xp: 140500,
    levelRequired: 395,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_33",
    name: "Apex Treasury Operation 33",
    durationMs: 12960 * 1000,
    payout: 87881082,
    xp: 144000,
    levelRequired: 400,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_34",
    name: "Apex Treasury Operation 34",
    durationMs: 13140 * 1000,
    payout: 97108596,
    xp: 147500,
    levelRequired: 405,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_35",
    name: "Apex Treasury Operation 35",
    durationMs: 13320 * 1000,
    payout: 107304999,
    xp: 151000,
    levelRequired: 410,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_36",
    name: "Apex Treasury Operation 36",
    durationMs: 13500 * 1000,
    payout: 118572024,
    xp: 154500,
    levelRequired: 415,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_37",
    name: "Apex Treasury Operation 37",
    durationMs: 13680 * 1000,
    payout: 131022086,
    xp: 158000,
    levelRequired: 420,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_38",
    name: "Apex Treasury Operation 38",
    durationMs: 13860 * 1000,
    payout: 144779405,
    xp: 161500,
    levelRequired: 425,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_39",
    name: "Apex Treasury Operation 39",
    durationMs: 14040 * 1000,
    payout: 159981243,
    xp: 165000,
    levelRequired: 430,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_40",
    name: "Apex Treasury Operation 40",
    durationMs: 14220 * 1000,
    payout: 176779273,
    xp: 168500,
    levelRequired: 435,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_41",
    name: "Apex Treasury Operation 41",
    durationMs: 14400 * 1000,
    payout: 195341097,
    xp: 172000,
    levelRequired: 440,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_42",
    name: "Apex Treasury Operation 42",
    durationMs: 14580 * 1000,
    payout: 215851912,
    xp: 175500,
    levelRequired: 445,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_43",
    name: "Apex Treasury Operation 43",
    durationMs: 14760 * 1000,
    payout: 238516363,
    xp: 179000,
    levelRequired: 450,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_44",
    name: "Apex Treasury Operation 44",
    durationMs: 14940 * 1000,
    payout: 263560581,
    xp: 182500,
    levelRequired: 455,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_45",
    name: "Apex Treasury Operation 45",
    durationMs: 15120 * 1000,
    payout: 291234442,
    xp: 186000,
    levelRequired: 460,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_46",
    name: "Apex Treasury Operation 46",
    durationMs: 15300 * 1000,
    payout: 321814058,
    xp: 189500,
    levelRequired: 465,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_47",
    name: "Apex Treasury Operation 47",
    durationMs: 15480 * 1000,
    payout: 355604534,
    xp: 193000,
    levelRequired: 470,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_48",
    name: "Apex Treasury Operation 48",
    durationMs: 15660 * 1000,
    payout: 392943010,
    xp: 196500,
    levelRequired: 475,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_49",
    name: "Apex Treasury Operation 49",
    durationMs: 15840 * 1000,
    payout: 434202026,
    xp: 200000,
    levelRequired: 480,
    educationRequired: "college"
  },
  {
    id: "apex_treasury_50",
    name: "Apex Treasury Operation 50",
    durationMs: 16020 * 1000,
    payout: 479793239,
    xp: 203500,
    levelRequired: 485,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_01",
    name: "Quantum Apex Contract 1",
    durationMs: 16260 * 1000,
    payout: 530000000,
    xp: 210000,
    levelRequired: 500,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_02",
    name: "Quantum Apex Contract 2",
    durationMs: 16500 * 1000,
    payout: 587240000,
    xp: 214500,
    levelRequired: 507,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_03",
    name: "Quantum Apex Contract 3",
    durationMs: 16740 * 1000,
    payout: 650661920,
    xp: 219000,
    levelRequired: 514,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_04",
    name: "Quantum Apex Contract 4",
    durationMs: 16980 * 1000,
    payout: 720933407,
    xp: 223500,
    levelRequired: 521,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_05",
    name: "Quantum Apex Contract 5",
    durationMs: 17220 * 1000,
    payout: 798794215,
    xp: 228000,
    levelRequired: 528,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_06",
    name: "Quantum Apex Contract 6",
    durationMs: 17460 * 1000,
    payout: 885063991,
    xp: 232500,
    levelRequired: 535,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_07",
    name: "Quantum Apex Contract 7",
    durationMs: 17700 * 1000,
    payout: 980650902,
    xp: 237000,
    levelRequired: 542,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_08",
    name: "Quantum Apex Contract 8",
    durationMs: 17940 * 1000,
    payout: 1086561199,
    xp: 241500,
    levelRequired: 549,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_09",
    name: "Quantum Apex Contract 9",
    durationMs: 18180 * 1000,
    payout: 1203909808,
    xp: 246000,
    levelRequired: 556,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_10",
    name: "Quantum Apex Contract 10",
    durationMs: 18420 * 1000,
    payout: 1333932068,
    xp: 250500,
    levelRequired: 563,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_11",
    name: "Quantum Apex Contract 11",
    durationMs: 18660 * 1000,
    payout: 1477996731,
    xp: 255000,
    levelRequired: 570,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_12",
    name: "Quantum Apex Contract 12",
    durationMs: 18900 * 1000,
    payout: 1637620378,
    xp: 259500,
    levelRequired: 577,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_13",
    name: "Quantum Apex Contract 13",
    durationMs: 19140 * 1000,
    payout: 1814483379,
    xp: 264000,
    levelRequired: 584,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_14",
    name: "Quantum Apex Contract 14",
    durationMs: 19380 * 1000,
    payout: 2010447584,
    xp: 268500,
    levelRequired: 591,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_15",
    name: "Quantum Apex Contract 15",
    durationMs: 19620 * 1000,
    payout: 2227575923,
    xp: 273000,
    levelRequired: 598,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_16",
    name: "Quantum Apex Contract 16",
    durationMs: 19860 * 1000,
    payout: 2468154123,
    xp: 277500,
    levelRequired: 605,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_17",
    name: "Quantum Apex Contract 17",
    durationMs: 20100 * 1000,
    payout: 2734714768,
    xp: 282000,
    levelRequired: 612,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_18",
    name: "Quantum Apex Contract 18",
    durationMs: 20340 * 1000,
    payout: 3030063963,
    xp: 286500,
    levelRequired: 619,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_19",
    name: "Quantum Apex Contract 19",
    durationMs: 20580 * 1000,
    payout: 3357310871,
    xp: 291000,
    levelRequired: 626,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_20",
    name: "Quantum Apex Contract 20",
    durationMs: 20820 * 1000,
    payout: 3719900445,
    xp: 295500,
    levelRequired: 633,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_21",
    name: "Quantum Apex Contract 21",
    durationMs: 21060 * 1000,
    payout: 4121649693,
    xp: 300000,
    levelRequired: 640,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_22",
    name: "Quantum Apex Contract 22",
    durationMs: 21300 * 1000,
    payout: 4566787860,
    xp: 304500,
    levelRequired: 647,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_23",
    name: "Quantum Apex Contract 23",
    durationMs: 21540 * 1000,
    payout: 5060000948,
    xp: 309000,
    levelRequired: 654,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_24",
    name: "Quantum Apex Contract 24",
    durationMs: 21780 * 1000,
    payout: 5606481051,
    xp: 313500,
    levelRequired: 661,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_25",
    name: "Quantum Apex Contract 25",
    durationMs: 22020 * 1000,
    payout: 6211981004,
    xp: 318000,
    levelRequired: 668,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_26",
    name: "Quantum Apex Contract 26",
    durationMs: 22260 * 1000,
    payout: 6882874953,
    xp: 322500,
    levelRequired: 675,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_27",
    name: "Quantum Apex Contract 27",
    durationMs: 22500 * 1000,
    payout: 7626225448,
    xp: 327000,
    levelRequired: 682,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_28",
    name: "Quantum Apex Contract 28",
    durationMs: 22740 * 1000,
    payout: 8449857796,
    xp: 331500,
    levelRequired: 689,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_29",
    name: "Quantum Apex Contract 29",
    durationMs: 22980 * 1000,
    payout: 9362442438,
    xp: 336000,
    levelRequired: 696,
    educationRequired: "college"
  },
  {
    id: "quantum_apex_30",
    name: "Quantum Apex Contract 30",
    durationMs: 23220 * 1000,
    payout: 10373586221,
    xp: 340500,
    levelRequired: 703,
    educationRequired: "college"
  }
];

export function refreshTimedState(state, now = Date.now()) {
  const storeUpdates = processStoreTimers(state, now);
  if (state.streak.windowEndsAt && now > state.streak.windowEndsAt) {
    state.streak.count = 0;
    state.streak.windowEndsAt = 0;
  }
  return {
    deliveredCount: Number(storeUpdates?.deliveredItems?.length || 0)
  };
}

export function canStartJob(state, jobId, now = Date.now()) {
  const job = JOBS.find((entry) => entry.id === jobId);
  if (!job) {
    return {
      ok: false,
      message: "Job not found."
    };
  }

  const effects = getPlayerEffects(state, now);
  if (state.level < job.levelRequired) {
    return {
      ok: false,
      message: `Unlocks at level ${job.levelRequired}.`
    };
  }
  if (job.educationRequired && !isEducationCompleted(state, job.educationRequired)) {
    return {
      ok: false,
      message: `Requires completed ${getEducationRequirementLabel(job.educationRequired)}.`
    };
  }
  if (state.activeJobs.length >= effects.maxActiveJobs) {
    return {
      ok: false,
      message: `All ${effects.maxActiveJobs} job slots are full.`
    };
  }

  return {
    ok: true,
    job,
    effects
  };
}

function getEducationRequirementLabel(programId) {
  return getEducationProgram(programId)?.name || "education program";
}

export function startJob(state, jobId, now = Date.now()) {
  const result = canStartJob(state, jobId, now);
  if (!result.ok) {
    return result;
  }

  const { job, effects } = result;
  const streakBonus = Math.min(state.streak.count * 0.05, 0.35);
  const crateBoosts = getCrateBoostMultipliers(state, now);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const durationMs = Math.max(
    5 * 1000,
    Math.round(job.durationMs * effects.durationMultiplier * Math.max(0, Number(powerMultipliers.jobTimeMult || 1)))
  );
  const payout = Math.round(
    job.payout
    * effects.payoutMultiplier
    * (1 + streakBonus)
    * Math.max(0, Number(crateBoosts.jobPayoutMultiplier || 1))
  );
  const xp = Math.round(job.xp * effects.xpMultiplier);

  state.activeJobs.push({
    id: `${job.id}_${now}_${Math.random().toString(36).slice(2, 7)}`,
    jobId: job.id,
    name: job.name,
    startedAt: now,
    endsAt: now + durationMs,
    payout,
    xp
  });

  pushLog(state, `Started ${job.name}.`, now);
  return {
    ok: true,
    job
  };
}

export function startJobToFillSlots(state, jobId, now = Date.now()) {
  const effects = getPlayerEffects(state, now);
  const openSlots = Math.max(0, effects.maxActiveJobs - state.activeJobs.length);
  if (openSlots < 1) {
    return {
      ok: false,
      message: `All ${effects.maxActiveJobs} job slots are full.`
    };
  }

  let started = 0;
  let firstJob = null;
  for (let i = 0; i < openSlots; i += 1) {
    const result = startJob(state, jobId, now + i);
    if (!result.ok) {
      if (started < 1) {
        return result;
      }
      break;
    }
    if (!firstJob) {
      firstJob = result.job;
    }
    started += 1;
  }

  return {
    ok: true,
    job: firstJob,
    startedCount: started
  };
}

export function claimReadyJobs(state, now = Date.now()) {
  const readyJobs = state.activeJobs.filter((job) => job.endsAt <= now);
  if (readyJobs.length < 1) {
    return {
      ok: false,
      message: "No jobs are ready yet."
    };
  }

  const effects = getPlayerEffects(state, now);
  const educationMultipliers = getEducationMultipliers(state);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const crateDrops = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0
  };
  let totalCash = 0;
  let totalXp = 0;

  for (const job of readyJobs) {
    const luckyDouble = effects.luckyDoubleChance > 0 && Math.random() < effects.luckyDoubleChance;
    const baseCash = luckyDouble ? job.payout * 2 : job.payout;
    totalCash += Math.round(
      baseCash
      // Education is applied at payout finalization only.
      * Math.max(0, Number(educationMultipliers.jobMultiplier || 1))
      * Math.max(0, Number(powerMultipliers.jobPayoutMult || 1))
    );

    const baseXp = Math.max(1, Math.round(job.xp * JOB_XP_CLAIM_MULTIPLIER));
    totalXp += Math.max(1, Math.round(baseXp));
    const drop = maybeAwardCrate(state, "jobComplete", now);
    if (drop?.rarity && Object.prototype.hasOwnProperty.call(crateDrops, drop.rarity)) {
      crateDrops[drop.rarity] += 1;
    }
  }

  state.activeJobs = state.activeJobs.filter((job) => job.endsAt > now);
  state.money += totalCash;
  state.stats.jobsCompleted += readyJobs.length;
  state.stats.totalEarned += totalCash;

  if (state.streak.windowEndsAt && now <= state.streak.windowEndsAt) {
    state.streak.count += readyJobs.length;
  } else {
    state.streak.count = readyJobs.length;
  }
  state.streak.best = Math.max(state.streak.best, state.streak.count);
  state.streak.lastClaimAt = now;
  state.streak.windowEndsAt = now + effects.streakWindowMs;

  const levelsGained = awardXp(state, totalXp, now);
  trackQuestEvent(state, "JOB_COMPLETE", { count: readyJobs.length, amount: totalCash });
  pushLog(state, `Claimed ${readyJobs.length} job(s): +$${totalCash} and +${totalXp} XP.`, now);
  const totalDrops = crateDrops.common + crateDrops.rare + crateDrops.epic + crateDrops.legendary;
  if (totalDrops > 0) {
    pushLog(
      state,
      `Crate drops: ${crateDrops.common} Common, ${crateDrops.rare} Rare, ${crateDrops.epic} Epic, ${crateDrops.legendary} Legendary.`,
      now
    );
  }

  return {
    ok: true,
    count: readyJobs.length,
    totalCash,
    totalXp,
    levelsGained,
    crateDrops
  };
}

export function useInstantJobToken(state, activeJobId, now = Date.now()) {
  if (!state.rebirthShop || typeof state.rebirthShop !== "object") {
    state.rebirthShop = { instantJobTokens: 0 };
  }
  const totalTokens = getInstantJobTokenCount(state);
  if (totalTokens < 1) {
    return {
      ok: false,
      message: "No instant job tokens available."
    };
  }

  const jobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  const targetIndex = jobs.findIndex((job) => job.id === activeJobId);
  if (targetIndex < 0) {
    return {
      ok: false,
      message: "Job not found."
    };
  }

  const [job] = jobs.splice(targetIndex, 1);
  state.activeJobs = jobs;
  const crateTokens = Math.max(0, Math.floor(Number(state?.instantTokens || 0)));
  if (crateTokens > 0) {
    state.instantTokens = crateTokens - 1;
  } else {
    const rebirthTokens = Math.max(0, Math.floor(Number(state?.rebirthShop?.instantJobTokens || 0)));
    state.rebirthShop.instantJobTokens = Math.max(0, rebirthTokens - 1);
  }

  const effects = getPlayerEffects(state, now);
  const educationMultipliers = getEducationMultipliers(state);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const luckyDouble = effects.luckyDoubleChance > 0 && Math.random() < effects.luckyDoubleChance;
  const baseCash = luckyDouble ? job.payout * 2 : job.payout;
  const totalCash = Math.round(
    baseCash
    * Math.max(0, Number(educationMultipliers.jobMultiplier || 1))
    * Math.max(0, Number(powerMultipliers.jobPayoutMult || 1))
  );
  const baseXp = Math.max(1, Math.round(job.xp * JOB_XP_CLAIM_MULTIPLIER));
  const totalXp = Math.max(1, Math.round(baseXp));

  state.money += totalCash;
  state.stats.jobsCompleted += 1;
  state.stats.totalEarned += totalCash;
  if (state.streak.windowEndsAt && now <= state.streak.windowEndsAt) {
    state.streak.count += 1;
  } else {
    state.streak.count = 1;
  }
  state.streak.best = Math.max(state.streak.best, state.streak.count);
  state.streak.lastClaimAt = now;
  state.streak.windowEndsAt = now + effects.streakWindowMs;

  const levelsGained = awardXp(state, totalXp, now);
  const drop = maybeAwardCrate(state, "jobComplete", now);
  trackQuestEvent(state, "JOB_COMPLETE", { count: 1, amount: totalCash });
  pushLog(state, `Used token on ${job.name}: +$${totalCash}, +${totalXp} XP.`, now);
  if (drop?.rarity) {
    pushLog(state, `Token completion crate drop: ${drop.rarity}.`, now);
  }

  return {
    ok: true,
    job,
    totalCash,
    totalXp,
    levelsGained,
    tokensLeft: getInstantJobTokenCount(state)
  };
}
