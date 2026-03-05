export const HS_LEVEL_REQ = 50;
export const HS_COST = 500_000;
export const HS_DURATION_MS = 8 * 60 * 60 * 1000;

// Keep college gate high for late-game progression.
export const COLLEGE_LEVEL_REQ = 150;
export const COLLEGE_COST = 10_000_000;
export const COLLEGE_DURATION_MS = 15 * 60 * 60 * 1000;

const VALID_STATUS = new Set(["not_started", "in_progress", "completed"]);

export const EDUCATION_PROGRAMS = [
  {
    id: "hs",
    name: "High School Diploma",
    levelReq: HS_LEVEL_REQ,
    cost: HS_COST,
    durationMs: HS_DURATION_MS
  },
  {
    id: "college",
    name: "College Degree",
    levelReq: COLLEGE_LEVEL_REQ,
    cost: COLLEGE_COST,
    durationMs: COLLEGE_DURATION_MS
  }
];

export function createDefaultEducationState() {
  return {
    hs: {
      status: "not_started",
      startedAt: null,
      endsAt: null
    },
    college: {
      status: "not_started",
      startedAt: null,
      endsAt: null
    },
    activeProgram: null
  };
}

export function createDefaultEducationPerks() {
  return {
    jobMultiplier: 1,
    businessMultiplier: 1
  };
}

export function ensureEducationState(state) {
  const fallbackEducation = createDefaultEducationState();
  const fallbackPerks = createDefaultEducationPerks();
  const rawEducation = state.education && typeof state.education === "object" ? state.education : {};

  state.education = {
    hs: normalizeProgramState(rawEducation.hs, fallbackEducation.hs),
    college: normalizeProgramState(rawEducation.college, fallbackEducation.college),
    activeProgram: rawEducation.activeProgram === "hs" || rawEducation.activeProgram === "college"
      ? rawEducation.activeProgram
      : null
  };

  const rawPerks = state.educationPerks && typeof state.educationPerks === "object" ? state.educationPerks : {};
  state.educationPerks = {
    jobMultiplier: clampMultiplier(rawPerks.jobMultiplier, fallbackPerks.jobMultiplier),
    businessMultiplier: clampMultiplier(rawPerks.businessMultiplier, fallbackPerks.businessMultiplier)
  };

  if (state.education.activeProgram) {
    const activeState = state.education[state.education.activeProgram];
    if (!activeState || activeState.status !== "in_progress") {
      state.education.activeProgram = null;
    }
  }

  return state;
}

export function enrollEducationProgram(state, programId, now = Date.now()) {
  ensureEducationState(state);
  const program = getEducationProgram(programId);
  if (!program) {
    return {
      ok: false,
      message: "Program not found."
    };
  }

  if (state.education.activeProgram) {
    return {
      ok: false,
      message: "You can only enroll in one program at a time."
    };
  }

  const slot = state.education[program.id];
  if (slot.status === "completed") {
    return {
      ok: false,
      message: "Program already completed."
    };
  }

  if (Number(state.level || 0) < program.levelReq) {
    return {
      ok: false,
      message: `Requires level ${program.levelReq}.`
    };
  }

  if (Number(state.money || 0) < program.cost) {
    return {
      ok: false,
      message: "Not enough cash."
    };
  }

  state.money -= program.cost;
  slot.status = "in_progress";
  slot.startedAt = now;
  slot.endsAt = now + program.durationMs;
  state.education.activeProgram = program.id;

  appendLog(state, `Enrolled in ${program.name}.`, now);
  return {
    ok: true,
    programId: program.id,
    programName: program.name
  };
}

export function checkEducationCompletion(state, now = Date.now()) {
  ensureEducationState(state);
  const activeId = state.education.activeProgram;
  if (!activeId) {
    return {
      completedCount: 0,
      completedPrograms: []
    };
  }

  const current = state.education[activeId];
  if (!current || current.status !== "in_progress") {
    state.education.activeProgram = null;
    return {
      completedCount: 0,
      completedPrograms: []
    };
  }

  const endsAt = Number(current.endsAt || 0);
  if (!Number.isFinite(endsAt) || endsAt > now) {
    return {
      completedCount: 0,
      completedPrograms: []
    };
  }

  current.status = "completed";
  current.startedAt = null;
  current.endsAt = null;
  state.education.activeProgram = null;
  grantEducationPerk(state, activeId, now);

  return {
    completedCount: 1,
    completedPrograms: [activeId]
  };
}

export function getEducationMultipliers(state) {
  ensureEducationState(state);
  return {
    jobMultiplier: clampMultiplier(state.educationPerks.jobMultiplier, 1),
    businessMultiplier: clampMultiplier(state.educationPerks.businessMultiplier, 1)
  };
}

export function getEducationProgram(programId) {
  return EDUCATION_PROGRAMS.find((entry) => entry.id === programId) || null;
}

export function isEducationCompleted(state, programId) {
  ensureEducationState(state);
  if (programId !== "hs" && programId !== "college") {
    return false;
  }
  return state.education[programId]?.status === "completed";
}

function grantEducationPerk(state, programId, now) {
  if (programId === "hs") {
    state.educationPerks.jobMultiplier = Math.max(
      clampMultiplier(state.educationPerks.jobMultiplier, 1),
      1.10
    );
    appendLog(state, "Completed High School Diploma: permanent +10% job payouts.", now);
    return;
  }
  if (programId === "college") {
    state.educationPerks.businessMultiplier = Math.max(
      clampMultiplier(state.educationPerks.businessMultiplier, 1),
      1.15
    );
    appendLog(state, "Completed College Degree: permanent +15% business payouts.", now);
  }
}

function normalizeProgramState(rawProgram, fallback) {
  const program = rawProgram && typeof rawProgram === "object" ? rawProgram : {};
  const status = VALID_STATUS.has(program.status) ? program.status : fallback.status;
  return {
    status,
    startedAt: numberOrNull(program.startedAt),
    endsAt: numberOrNull(program.endsAt)
  };
}

function appendLog(state, message, now) {
  const current = Array.isArray(state.log) ? state.log : [];
  state.log = [{ message, at: now }, ...current].slice(0, 15);
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function clampMultiplier(value, fallback) {
  const safe = Number.isFinite(value) ? value : fallback;
  return Math.max(1, safe);
}
