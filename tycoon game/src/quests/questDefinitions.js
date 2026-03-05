function buildQuests() {
  const quests = [];

  function addQuest(def) {
    const id = `Q${String(quests.length + 1).padStart(3, "0")}`;
    quests.push({
      id,
      title: def.title,
      desc: def.desc,
      category: def.category,
      requirement: def.requirement,
      reward: def.reward
    });
  }

  const jobCountTargets = [3, 5, 8, 12, 16, 20, 25, 30, 35, 40];
  jobCountTargets.forEach((target, index) => {
    addQuest({
      title: `Shift Grinder ${index + 1}`,
      desc: `Complete ${target} jobs today.`,
      category: "jobs",
      requirement: { event: "JOB_COMPLETE", target, mode: "count" },
      reward: { cash: 800 + target * 220, xp: 120 + target * 30 }
    });
  });

  const jobCashTargets = [2000, 5000, 10000, 20000, 40000, 75000, 125000, 200000, 350000, 500000];
  jobCashTargets.forEach((target, index) => {
    addQuest({
      title: `Payroll Push ${index + 1}`,
      desc: `Earn $${target.toLocaleString()} from jobs.`,
      category: "jobs",
      requirement: { event: "JOB_COMPLETE", target, mode: "sum" },
      reward: { cash: 1000 + Math.round(target * 0.12), xp: 180 + index * 70 }
    });
  });

  const bizCollectTargets = [1, 2, 3, 4, 6, 8, 10, 12];
  bizCollectTargets.forEach((target, index) => {
    addQuest({
      title: `Passive Pulse ${index + 1}`,
      desc: `Collect business payouts ${target} times.`,
      category: "business",
      requirement: { event: "BIZ_COLLECT", target, mode: "count" },
      reward: { cash: 1400 + target * 420, xp: 120 + index * 60 }
    });
  });

  const bizCashTargets = [5000, 15000, 40000, 100000, 250000, 600000, 1200000];
  bizCashTargets.forEach((target, index) => {
    addQuest({
      title: `Enterprise Earnings ${index + 1}`,
      desc: `Earn $${target.toLocaleString()} from businesses.`,
      category: "business",
      requirement: { event: "BIZ_COLLECT", target, mode: "sum" },
      reward: { cash: 1800 + Math.round(target * 0.1), xp: 180 + index * 90 }
    });
  });

  const itemBuyTargets = [1, 2, 3, 4, 5, 6];
  itemBuyTargets.forEach((target, index) => {
    addQuest({
      title: `Shop Runner ${index + 1}`,
      desc: `Buy ${target} store item(s).`,
      category: "store",
      requirement: { event: "ITEM_BUY", target, mode: "count" },
      reward: { cash: 900 + index * 700, xp: 130 + index * 55 }
    });
  });

  const storeSpendTargets = [2000, 7000, 15000, 35000, 80000];
  storeSpendTargets.forEach((target, index) => {
    addQuest({
      title: `Checkout Total ${index + 1}`,
      desc: `Spend $${target.toLocaleString()} in the store.`,
      category: "store",
      requirement: { event: "ITEM_SPEND", target, mode: "sum" },
      reward: { cash: 1200 + Math.round(target * 0.15), xp: 180 + index * 80 }
    });
  });

  const activateTargets = [1, 2, 3, 4];
  activateTargets.forEach((target, index) => {
    addQuest({
      title: `Boost Rotation ${index + 1}`,
      desc: `Activate ${target} item ability(s).`,
      category: "store",
      requirement: { event: "ITEM_ACTIVATE", target, mode: "count" },
      reward: { cash: 1400 + index * 1200, xp: 220 + index * 95 }
    });
  });

  const xpTargets = [500, 1500, 3000, 6000, 10000, 18000];
  xpTargets.forEach((target, index) => {
    addQuest({
      title: `XP Sprint ${index + 1}`,
      desc: `Gain ${target.toLocaleString()} XP.`,
      category: "level",
      requirement: { event: "XP_GAIN", target, mode: "sum" },
      reward: { cash: 1600 + Math.round(target * 0.25), xp: 0 }
    });
  });

  const levelTargets = [1, 2, 3, 4];
  levelTargets.forEach((target, index) => {
    addQuest({
      title: `Rank Climber ${index + 1}`,
      desc: `Gain ${target} level(s).`,
      category: "level",
      requirement: { event: "LEVEL_UP", target, mode: "count" },
      reward: { cash: 2200 + index * 2600, xp: 300 + index * 140 }
    });
  });

  const cashBalanceTargets = [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 20000000, 100000000];
  cashBalanceTargets.forEach((target, index) => {
    addQuest({
      title: `Cash Reserve ${index + 1}`,
      desc: `Reach a cash balance of $${target.toLocaleString()}.`,
      category: "economy",
      requirement: { event: "CASH_BALANCE", target, mode: "sum" },
      reward: { cash: 2500 + Math.round(target * 0.05), xp: 250 + index * 120 }
    });
  });

  addQuest({
    title: "Graduate Goal",
    desc: "Complete High School Diploma.",
    category: "education",
    requirement: { event: "EDU_HS_COMPLETED", target: 1, mode: "sum" },
    reward: { cash: 50000, xp: 1200 }
  });
  addQuest({
    title: "Campus Accepted",
    desc: "Complete College Degree.",
    category: "education",
    requirement: { event: "EDU_COLLEGE_COMPLETED", target: 1, mode: "sum" },
    reward: { cash: 250000, xp: 3500 }
  });
  addQuest({
    title: "Full Scholar",
    desc: "Complete both High School Diploma and College Degree.",
    category: "education",
    requirement: { event: "EDU_BOTH_COMPLETED", target: 1, mode: "sum" },
    reward: { cash: 600000, xp: 6000 }
  });
  addQuest({
    title: "Diploma Holder",
    desc: "Own a completed High School Diploma status.",
    category: "education",
    requirement: { event: "EDU_HS_COMPLETED", target: 1, mode: "sum" },
    reward: { cash: 80000, xp: 1500 }
  });
  addQuest({
    title: "Degree Holder",
    desc: "Own a completed College Degree status.",
    category: "education",
    requirement: { event: "EDU_COLLEGE_COMPLETED", target: 1, mode: "sum" },
    reward: { cash: 320000, xp: 3800 }
  });

  if (quests.length !== 75) {
    throw new Error(`Quest definitions mismatch: expected 75, got ${quests.length}.`);
  }

  return quests;
}

export const QUESTS = buildQuests();

export const QUESTS_BY_ID = QUESTS.reduce((acc, quest) => {
  acc[quest.id] = quest;
  return acc;
}, {});
