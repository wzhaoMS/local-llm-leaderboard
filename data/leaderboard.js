window.LB_DATA = {
 "schema": "local-llm-leaderboard@1",
 "generated": "2026-11-25T17:11-05:00",
 "site": {
  "title": "Local LLM leaderboard",
  "subtitle": "RTX PRO 6000 + RTX 5090 workstation",
  "repo": "https://github.com/wzhaoMS/local-llm-leaderboard"
 },
 "hardware": {
  "gpus": [
   {
    "name": "NVIDIA RTX PRO 6000 Blackwell",
    "vramGB": 96
   },
   {
    "name": "NVIDIA GeForce RTX 5090",
    "vramGB": 32
   }
  ],
  "cpu": "AMD Ryzen 9 9950X3D2 (16 cores / 32 threads)",
  "ramGB": 128,
  "storage": [
   "Samsung 990 EVO Plus 4 TB NVMe",
   "KIOXIA XG10 512 GB NVMe"
  ],
  "os": "Windows 11",
  "engine": "llama.cpp b12675 (Unsloth fork), CUDA 13.3"
 },
 "core": {
  "perSuite": 6,
  "tasks": 59,
  "suites": [
   "tool_calling",
   "zh_intent",
   "finance_extract",
   "ts_coding",
   "reasoning",
   "vision",
   "browser_agent",
   "agent_e2e",
   "repo_qa"
  ],
  "textSuites": [
   "tool_calling",
   "zh_intent",
   "finance_extract",
   "ts_coding",
   "reasoning",
   "browser_agent",
   "agent_e2e",
   "repo_qa"
  ],
  "gradedRuns": 2187
 },
 "suites": [
  {
   "key": "tool_calling",
   "name": "Tool calling",
   "short": "Tools",
   "group": "daily",
   "desc": "Pick the right tool and arguments from a toolset (JSON function calls).",
   "inCore": true
  },
  {
   "key": "zh_intent",
   "name": "Chinese intent",
   "short": "中文",
   "group": "daily",
   "desc": "Understand terse, voice-dictated Chinese requests: intent, key facts, and when to ask back.",
   "inCore": true
  },
  {
   "key": "finance_extract",
   "name": "Statement extraction",
   "short": "Extract",
   "group": "daily",
   "desc": "Turn bank and card statements and receipts into strict JSON transactions.",
   "inCore": true
  },
  {
   "key": "ts_coding",
   "name": "TypeScript coding",
   "short": "Code",
   "group": "coding",
   "desc": "Write a function from a spec; graded by hidden unit tests.",
   "inCore": true
  },
  {
   "key": "reasoning",
   "name": "Finance math",
   "short": "Math",
   "group": "daily",
   "desc": "Multi-step numeric reasoning (interest, amortization, APY) with an exact answer.",
   "inCore": true
  },
  {
   "key": "vision",
   "name": "Vision",
   "short": "Vision",
   "group": "daily",
   "desc": "Read screenshots, receipts and statements.",
   "inCore": true
  },
  {
   "key": "browser_agent",
   "name": "Browser agent",
   "short": "Browser",
   "group": "agents",
   "desc": "Drive a simulated web app through tool calls to finish a task.",
   "inCore": true
  },
  {
   "key": "agent_e2e",
   "name": "Agent fix loop",
   "short": "Fix loop",
   "group": "coding",
   "desc": "Fix a small bug in a mini repo with read, edit and run-tests tools.",
   "inCore": true
  },
  {
   "key": "repo_qa",
   "name": "Long-context repo QA",
   "short": "Repo QA",
   "group": "coding",
   "desc": "Answer questions about a real TypeScript monorepo at 16K-64K tokens of context.",
   "inCore": true
  },
  {
   "key": "repo_replay",
   "name": "Real-repo bug fixes",
   "short": "Repo fixes",
   "group": "coding",
   "desc": "Replay 9 real fix commits in a scratch clone: explore, edit and run the real test suite.",
   "inCore": false
  },
  {
   "key": "debug",
   "name": "Debugging",
   "short": "Debug",
   "group": "coding",
   "desc": "10 bugs reported only by their symptom: reproduce, find the root cause, fix; hidden tests decide.",
   "inCore": false
  },
  {
   "key": "long_horizon",
   "name": "Long sessions",
   "short": "Long",
   "group": "agents",
   "desc": "3 multi-stage sessions (6-7 stages each) with standing rules, recall probes and cumulative hidden tests.",
   "inCore": false
  }
 ],
 "vendors": {
  "qwen": {
   "name": "Qwen",
   "org": "Alibaba",
   "color": "#ef7a5a",
   "letter": "Q",
   "country": "CN"
  },
  "zai": {
   "name": "Z.ai",
   "org": "Zhipu",
   "color": "#8b5cf6",
   "letter": "Z",
   "country": "CN"
  },
  "deepseek": {
   "name": "DeepSeek",
   "org": "DeepSeek",
   "color": "#6366f1",
   "letter": "D",
   "country": "CN"
  },
  "xiaomi": {
   "name": "Xiaomi",
   "org": "Xiaomi MiMo",
   "color": "#f59e0b",
   "letter": "Mi",
   "country": "CN"
  },
  "stepfun": {
   "name": "StepFun",
   "org": "StepFun",
   "color": "#0ea5e9",
   "letter": "S",
   "country": "CN"
  },
  "ant": {
   "name": "Ant Group",
   "org": "inclusionAI",
   "color": "#10b981",
   "letter": "L",
   "country": "CN"
  },
  "minimax": {
   "name": "MiniMax",
   "org": "MiniMax",
   "color": "#e5487f",
   "letter": "M",
   "country": "CN"
  },
  "moonshot": {
   "name": "Moonshot AI",
   "org": "Moonshot AI",
   "color": "#0e9aa7",
   "letter": "K",
   "country": "CN"
  },
  "tml": {
   "name": "Thinking Machines",
   "org": "Thinking Machines Lab",
   "color": "#64748b",
   "letter": "T",
   "country": "US"
  }
 },
 "models": [
  {
   "id": "deepseek-v41-flash-offload",
   "name": "DeepSeek-V4.1-Flash",
   "short": "DeepSeek-V4.1-Flash",
   "variant": "IQ2_XXS · GPUs + RAM",
   "vendor": "deepseek",
   "params": "748B-A16B",
   "quant": "UD-IQ2_XXS",
   "placement": "hybrid",
   "where": "2 GPUs + RAM",
   "recommended": false,
   "partial": false,
   "speedOnly": true,
   "status": "done",
   "notes": "Speed only: too slow and RAM-hungry for daily use (~114 GiB private RAM).",
   "vramGiB": [
    90.4,
    19.8
   ],
   "ramGiB": 21.0,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": {
    "decode": 17.1,
    "inTaskDecode": null,
    "ttft": null,
    "firstOutput": null,
    "taskTime": null,
    "prefill": {
     "8k": 367.0,
     "32k": 417.0
    },
    "ttftAt": {
     "8k": 24.5,
     "32k": 79.0
    },
    "decodeAt": {
     "8k": 24.0,
     "32k": 25.0
    },
    "ctx": 65536,
    "mtp": {
     "on": 17.1,
     "off": null,
     "acceptance": 40.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 0
  },
  {
   "id": "deepseek41-coder-6000",
   "name": "DeepSeek-V4.1-Flash Coder",
   "short": "DeepSeek-V4.1 Coder",
   "variant": "half the experts pruned",
   "vendor": "deepseek",
   "params": "763B-A16B (192/384 experts)",
   "quant": "GSQ-RCO IQ2_XXS",
   "placement": "1gpu",
   "where": "RTX PRO 6000 + SSD",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "72 GB transformer on one GPU; the 111 GB Engram table stays on NVMe and is read one row per token, so it needs ~8 GB of RAM.",
   "vramGiB": [
    83.8,
    0.0
   ],
   "ramGiB": 1.3,
   "scores": {
    "textCore": 90.1,
    "textCoreCI": [
     83.0,
     96.7
    ],
    "allSuites": 91.2,
    "suites": {
     "tool_calling": 83.3,
     "zh_intent": 87.2,
     "finance_extract": 100.0,
     "ts_coding": 83.3,
     "reasoning": 66.7,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 100.0
    },
    "repo_replay": 100.0,
    "debug": 100.0,
    "long_horizon": 94.7
   },
   "suiteTimeS": {
    "tool_calling": 1.3,
    "zh_intent": 13.9,
    "finance_extract": 9.1,
    "ts_coding": 80.4,
    "reasoning": 34.5,
    "vision": 1.7,
    "browser_agent": 6.4,
    "agent_e2e": 14.5,
    "repo_qa": 2.4
   },
   "agentic": {
    "repo_replay": {
     "rate": 100.0,
     "runs": 9,
     "tasks": 9,
     "medianWallS": 97.0,
     "medianTimeToCorrectS": 85.0,
     "medianSteps": 18.0
    },
    "debug": {
     "rate": 100.0,
     "runs": 10,
     "tasks": 10,
     "medianWallS": 75.0,
     "medianTimeToFixS": 39.0,
     "reproducedFirst": 70.0,
     "rootCauseNamed": 100.0
    },
    "long_horizon": {
     "rate": 94.7,
     "score": 94.4,
     "sessions": 3,
     "stagesPassed": 18,
     "stagesTotal": 19,
     "recall": 100.0,
     "violations": 0,
     "medianWallMin": 7.1,
     "maxPromptTokens": 56252
    }
   },
   "speed": {
    "decode": 105.3,
    "inTaskDecode": 102.6,
    "ttft": 0.44,
    "firstOutput": 2.5,
    "taskTime": 8.4,
    "prefill": {
     "8k": 1769.0,
     "32k": 1767.0,
     "64k": 1566.0,
     "117k": 1245.0
    },
    "ttftAt": {
     "8k": 4.8,
     "32k": 18.8,
     "64k": 42.1,
     "117k": 97.5
    },
    "decodeAt": {
     "8k": 113.0,
     "32k": 92.0,
     "64k": 97.0,
     "117k": 97.0
    },
    "ctx": 131072,
    "mtp": {
     "on": null,
     "off": null,
     "acceptance": 45.0,
     "draft": null
    }
   },
   "endurance": null,
   "rows": 102
  },
  {
   "id": "flashnext-q4-1gpu-low",
   "name": "Qwen3.8-Flash-Next",
   "short": "Flash-Next Q4 low",
   "variant": "Q4 · effort low",
   "vendor": "qwen",
   "params": "125B-A6B",
   "quant": "UD-Q4_K_XL",
   "placement": "1gpu",
   "where": "RTX PRO 6000",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Same weights with reasoning effort low: faster, less accurate.",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": 90.4,
    "textCoreCI": [
     82.5,
     97.1
    ],
    "allSuites": 91.5,
    "suites": {
     "tool_calling": 83.3,
     "zh_intent": 73.3,
     "finance_extract": 100.0,
     "ts_coding": 83.3,
     "reasoning": 83.3,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 100.0
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 0.9,
    "zh_intent": 4.2,
    "finance_extract": 4.7,
    "ts_coding": 26.2,
    "reasoning": 9.9,
    "vision": 1.2,
    "browser_agent": 5.8,
    "agent_e2e": 13.7,
    "repo_qa": 1.2
   },
   "agentic": null,
   "speed": {
    "decode": 175.7,
    "inTaskDecode": 182.2,
    "ttft": 0.29,
    "firstOutput": 1.3,
    "taskTime": 3.8,
    "prefill": null,
    "ttftAt": null,
    "decodeAt": null,
    "ctx": null,
    "mtp": null
   },
   "endurance": null,
   "rows": 80
  },
  {
   "id": "flashnext-q4-1gpu-medium",
   "name": "Qwen3.8-Flash-Next",
   "short": "Flash-Next Q4",
   "variant": "Q4 · effort medium",
   "vendor": "qwen",
   "params": "125B-A6B",
   "quant": "UD-Q4_K_XL",
   "placement": "1gpu",
   "where": "RTX PRO 6000",
   "recommended": true,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "MTP draft 3, reasoning effort medium. The default model on this PC.",
   "vramGiB": [
    88.5,
    0.0
   ],
   "ramGiB": 1.5,
   "scores": {
    "textCore": 96.1,
    "textCoreCI": [
     92.9,
     98.6
    ],
    "allSuites": 96.5,
    "suites": {
     "tool_calling": 94.4,
     "zh_intent": 90.7,
     "finance_extract": 100.0,
     "ts_coding": 100.0,
     "reasoning": 83.3,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 100.0
    },
    "repo_replay": 92.6,
    "debug": 100.0,
    "long_horizon": 100.0
   },
   "suiteTimeS": {
    "tool_calling": 0.8,
    "zh_intent": 8.1,
    "finance_extract": 7.0,
    "ts_coding": 36.5,
    "reasoning": 24.4,
    "vision": 1.0,
    "browser_agent": 4.3,
    "agent_e2e": 9.9,
    "repo_qa": 1.6
   },
   "agentic": {
    "repo_replay": {
     "rate": 92.6,
     "runs": 27,
     "tasks": 9,
     "medianWallS": 94.0,
     "medianTimeToCorrectS": 58.0,
     "medianSteps": 27.0
    },
    "debug": {
     "rate": 100.0,
     "runs": 10,
     "tasks": 10,
     "medianWallS": 60.0,
     "medianTimeToFixS": 31.0,
     "reproducedFirst": 60.0,
     "rootCauseNamed": 100.0
    },
    "long_horizon": {
     "rate": 100.0,
     "score": 100.0,
     "sessions": 3,
     "stagesPassed": 19,
     "stagesTotal": 19,
     "recall": 100.0,
     "violations": 0,
     "medianWallMin": 4.7,
     "maxPromptTokens": 114870
    }
   },
   "speed": {
    "decode": 162.6,
    "inTaskDecode": 158.6,
    "ttft": 0.3,
    "firstOutput": 1.3,
    "taskTime": 5.2,
    "prefill": {
     "8k": 4926.0,
     "32k": 5290.0,
     "64k": 5435.0,
     "117k": 5160.0
    },
    "ttftAt": {
     "8k": 1.7,
     "32k": 6.5,
     "64k": 12.4,
     "117k": 24.0
    },
    "decodeAt": {
     "8k": 136.0,
     "32k": 122.0,
     "64k": 127.0,
     "117k": 99.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 162.6,
     "off": null,
     "acceptance": 59.0,
     "draft": 3
    }
   },
   "endurance": {
    "minutes": 20.0,
    "requests": 267,
    "errors": 0,
    "restarts": 7,
    "decodeMedian": 115.1,
    "ttftMedian": 1.29,
    "cacheHit": 93.3,
    "acceptRate": 60.4,
    "sustainRatio": 1.04
   },
   "rows": 280
  },
  {
   "id": "flashnext-q5-2gpu-medium",
   "name": "Qwen3.8-Flash-Next",
   "short": "Flash-Next Q5",
   "variant": "Q5 · both GPUs",
   "vendor": "qwen",
   "params": "125B-A6B",
   "quant": "UD-Q5_K_XL",
   "placement": "2gpu",
   "where": "PRO 6000 + 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Higher-precision weights split across both cards; scored on 1 run.",
   "vramGiB": [
    88.5,
    20.3
   ],
   "ramGiB": 2.9,
   "scores": {
    "textCore": 96.7,
    "textCoreCI": [
     92.1,
     100.0
    ],
    "allSuites": 97.0,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 90.0,
     "finance_extract": 100.0,
     "ts_coding": 100.0,
     "reasoning": 83.3,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 100.0
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 0.9,
    "zh_intent": 9.2,
    "finance_extract": 6.6,
    "ts_coding": 42.1,
    "reasoning": 32.1,
    "vision": 1.4,
    "browser_agent": 4.2,
    "agent_e2e": 9.9,
    "repo_qa": 1.6
   },
   "agentic": null,
   "speed": {
    "decode": 135.0,
    "inTaskDecode": 158.7,
    "ttft": 0.39,
    "firstOutput": 1.6,
    "taskTime": 6.0,
    "prefill": {
     "8k": 4499.0,
     "32k": 5007.0,
     "64k": 5009.0,
     "117k": 4687.0
    },
    "ttftAt": {
     "8k": 2.0,
     "32k": 6.8,
     "64k": 13.5,
     "117k": 26.5
    },
    "decodeAt": {
     "8k": 130.0,
     "32k": 79.0,
     "64k": 96.0,
     "117k": 66.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 135.0,
     "off": 80.5,
     "acceptance": 58.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 80
  },
  {
   "id": "glm47flash-5090",
   "name": "GLM-4.7-Flash",
   "short": "GLM-4.7-Flash",
   "variant": "Q5",
   "vendor": "zai",
   "params": "30B-A3B",
   "quant": "UD-Q5_K_XL",
   "placement": "1gpu",
   "where": "RTX 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Fast but weak at coding on these tasks.",
   "vramGiB": [
    77.2,
    22.9
   ],
   "ramGiB": 0.9,
   "scores": {
    "textCore": 62.4,
    "textCoreCI": [
     54.0,
     70.9
    ],
    "allSuites": 62.4,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 74.2,
     "finance_extract": 83.3,
     "ts_coding": 0.0,
     "reasoning": 33.3,
     "vision": null,
     "browser_agent": 100.0,
     "agent_e2e": 66.7,
     "repo_qa": 41.7
    },
    "repo_replay": 44.4,
    "debug": 40.0,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 1.0,
    "zh_intent": 13.9,
    "finance_extract": 14.7,
    "ts_coding": 42.5,
    "reasoning": 80.1,
    "vision": null,
    "browser_agent": 4.6,
    "agent_e2e": 18.4,
    "repo_qa": 3.5
   },
   "agentic": {
    "repo_replay": {
     "rate": 44.4,
     "runs": 9,
     "tasks": 9,
     "medianWallS": 61.0,
     "medianTimeToCorrectS": 29.0,
     "medianSteps": 40.0
    },
    "debug": {
     "rate": 40.0,
     "runs": 10,
     "tasks": 10,
     "medianWallS": 76.0,
     "medianTimeToFixS": 63.0,
     "reproducedFirst": 70.0,
     "rootCauseNamed": 10.0
    }
   },
   "speed": {
    "decode": 211.4,
    "inTaskDecode": 164.9,
    "ttft": 0.1,
    "firstOutput": 7.8,
    "taskTime": 11.2,
    "prefill": {
     "8k": 8920.0,
     "32k": 4202.0,
     "58k": 2610.0
    },
    "ttftAt": {
     "8k": 1.0,
     "32k": 8.0,
     "58k": 23.4
    },
    "decodeAt": {
     "8k": 175.0,
     "32k": 123.0,
     "58k": 94.0
    },
    "ctx": 65536,
    "mtp": {
     "on": null,
     "off": null,
     "acceptance": null,
     "draft": null
    }
   },
   "endurance": null,
   "rows": 87
  },
  {
   "id": "glm53flash-q2-2gpu",
   "name": "GLM-5.3-Flash",
   "short": "GLM-5.3-Flash Q2",
   "variant": "Q2 · both GPUs",
   "vendor": "zai",
   "params": "321B-A18B",
   "quant": "UD-Q2_K_XL",
   "placement": "2gpu",
   "where": "PRO 6000 + 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Best Chinese-intent score; built-in MTP layer (draft 2). Text only on this build.",
   "vramGiB": [
    83.9,
    25.3
   ],
   "ramGiB": 2.2,
   "scores": {
    "textCore": 95.5,
    "textCoreCI": [
     89.2,
     100.0
    ],
    "allSuites": 95.5,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 97.2,
     "finance_extract": 100.0,
     "ts_coding": 83.3,
     "reasoning": 83.3,
     "vision": null,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 100.0
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 0.9,
    "zh_intent": 8.3,
    "finance_extract": 4.3,
    "ts_coding": 39.2,
    "reasoning": 13.3,
    "vision": null,
    "browser_agent": 6.0,
    "agent_e2e": 23.0,
    "repo_qa": 2.3
   },
   "agentic": null,
   "speed": {
    "decode": 95.9,
    "inTaskDecode": 95.0,
    "ttft": 0.5,
    "firstOutput": 1.8,
    "taskTime": 6.1,
    "prefill": {
     "8k": 2265.0,
     "32k": 1910.0,
     "64k": 1770.0,
     "117k": 1583.0
    },
    "ttftAt": {
     "8k": 3.7,
     "32k": 17.4,
     "64k": 37.2,
     "117k": 76.9
    },
    "decodeAt": {
     "8k": 87.0,
     "32k": 108.0,
     "64k": 89.0,
     "117k": 94.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 95.9,
     "off": null,
     "acceptance": 58.0,
     "draft": 2
    }
   },
   "endurance": null,
   "rows": 74
  },
  {
   "id": "inkling2mini-5090",
   "name": "Inkling-2-Mini",
   "short": "Inkling-2-Mini",
   "variant": "Q4 (US reference)",
   "vendor": "tml",
   "params": "26B-A3.4B",
   "quant": "UD-Q4_K_XL",
   "placement": "1gpu",
   "where": "RTX 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "US open-weight reference model; no draft model on this llama.cpp build.",
   "vramGiB": [
    0.6,
    21.0
   ],
   "ramGiB": 1.8,
   "scores": {
    "textCore": 87.4,
    "textCoreCI": [
     80.5,
     94.2
    ],
    "allSuites": 88.8,
    "suites": {
     "tool_calling": 66.7,
     "zh_intent": 82.5,
     "finance_extract": 100.0,
     "ts_coding": 50.0,
     "reasoning": 100.0,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 100.0
    },
    "repo_replay": 66.7,
    "debug": 80.0,
    "long_horizon": 100.0
   },
   "suiteTimeS": {
    "tool_calling": 1.3,
    "zh_intent": 16.2,
    "finance_extract": 13.4,
    "ts_coding": 126.6,
    "reasoning": 39.0,
    "vision": 1.9,
    "browser_agent": 5.8,
    "agent_e2e": 42.4,
    "repo_qa": 2.4
   },
   "agentic": {
    "repo_replay": {
     "rate": 66.7,
     "runs": 9,
     "tasks": 9,
     "medianWallS": 196.0,
     "medianTimeToCorrectS": 113.0,
     "medianSteps": 27.0
    },
    "debug": {
     "rate": 80.0,
     "runs": 10,
     "tasks": 10,
     "medianWallS": 120.0,
     "medianTimeToFixS": 53.0,
     "reproducedFirst": 70.0,
     "rootCauseNamed": 50.0
    },
    "long_horizon": {
     "rate": 100.0,
     "score": 100.0,
     "sessions": 3,
     "stagesPassed": 19,
     "stagesTotal": 19,
     "recall": 100.0,
     "violations": 0,
     "medianWallMin": 13.8,
     "maxPromptTokens": 113606
    }
   },
   "speed": {
    "decode": 128.8,
    "inTaskDecode": 126.5,
    "ttft": 0.31,
    "firstOutput": 3.1,
    "taskTime": 9.0,
    "prefill": {
     "8k": 6918.0,
     "32k": 6621.0,
     "64k": 5703.0,
     "117k": 4538.0
    },
    "ttftAt": {
     "8k": 1.3,
     "32k": 5.2,
     "64k": 12.0,
     "117k": 27.6
    },
    "decodeAt": {
     "8k": 126.0,
     "32k": 117.0,
     "64k": 109.0,
     "117k": 95.0
    },
    "ctx": 131072,
    "mtp": {
     "on": null,
     "off": null,
     "acceptance": null,
     "draft": null
    }
   },
   "endurance": null,
   "rows": 96
  },
  {
   "id": "ling32air-6000",
   "name": "Ling-3.2-air",
   "short": "Ling-3.2-air",
   "variant": "Q4",
   "vendor": "ant",
   "params": "124B-A5.5B",
   "quant": "Q4_K_M",
   "placement": "1gpu",
   "where": "RTX PRO 6000",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Fast decoder; weak at coding and math here.",
   "vramGiB": [
    78.2,
    0.0
   ],
   "ramGiB": 1.5,
   "scores": {
    "textCore": 71.3,
    "textCoreCI": [
     62.1,
     80.3
    ],
    "allSuites": 74.5,
    "suites": {
     "tool_calling": 66.7,
     "zh_intent": 86.8,
     "finance_extract": 100.0,
     "ts_coding": 16.7,
     "reasoning": 33.3,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 83.3,
     "repo_qa": 83.3
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 1.1,
    "zh_intent": 6.1,
    "finance_extract": 3.6,
    "ts_coding": 70.9,
    "reasoning": 111.6,
    "vision": 1.2,
    "browser_agent": 6.9,
    "agent_e2e": 10.9,
    "repo_qa": 1.5
   },
   "agentic": null,
   "speed": {
    "decode": 180.5,
    "inTaskDecode": 217.8,
    "ttft": 0.24,
    "firstOutput": 1.6,
    "taskTime": 4.9,
    "prefill": {
     "8k": 6718.0,
     "32k": 6134.0,
     "58k": 5129.0
    },
    "ttftAt": {
     "8k": 1.3,
     "32k": 5.5,
     "58k": 11.9
    },
    "decodeAt": {
     "8k": 193.0,
     "32k": 182.0,
     "58k": 176.0
    },
    "ctx": 65536,
    "mtp": {
     "on": 180.5,
     "off": null,
     "acceptance": 38.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 74
  },
  {
   "id": "mimo26flash-2gpu",
   "name": "MiMo-V2.6-Flash",
   "short": "MiMo-V2.6-Flash",
   "variant": "2.5 bpw · both GPUs",
   "vendor": "xiaomi",
   "params": "309B-A15B",
   "quant": "BPW2.5",
   "placement": "2gpu",
   "where": "PRO 6000 + 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Separate MTP head (draft 3, ~45-55% acceptance).",
   "vramGiB": [
    79.3,
    20.3
   ],
   "ramGiB": 4.0,
   "scores": {
    "textCore": 88.7,
    "textCoreCI": [
     81.9,
     94.8
    ],
    "allSuites": 88.7,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 85.1,
     "finance_extract": 99.1,
     "ts_coding": 83.3,
     "reasoning": 50.0,
     "vision": null,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 91.7
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 1.1,
    "zh_intent": 6.7,
    "finance_extract": 4.1,
    "ts_coding": 97.0,
    "reasoning": 57.7,
    "vision": null,
    "browser_agent": 5.2,
    "agent_e2e": 18.7,
    "repo_qa": 0.9
   },
   "agentic": null,
   "speed": {
    "decode": 125.5,
    "inTaskDecode": 134.4,
    "ttft": 0.25,
    "firstOutput": 0.9,
    "taskTime": 4.6,
    "prefill": {
     "8k": 3499.0,
     "32k": 3450.0,
     "64k": 3183.0,
     "117k": 2813.0
    },
    "ttftAt": {
     "8k": 2.4,
     "32k": 9.6,
     "64k": 20.7,
     "117k": 43.3
    },
    "decodeAt": {
     "8k": 120.0,
     "32k": 119.0,
     "64k": 108.0,
     "117k": 90.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 125.5,
     "off": null,
     "acceptance": 41.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 74
  },
  {
   "id": "qwen36-35b-a3b",
   "name": "Qwen3.6-35B-A3B",
   "short": "Qwen3.6-35B",
   "variant": "thinking",
   "vendor": "qwen",
   "params": "35B-A3B",
   "quant": "UD-Q4_K_XL",
   "placement": "1gpu",
   "where": "RTX 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Small MoE, thinking on, no draft model.",
   "vramGiB": [
    0.0,
    24.9
   ],
   "ramGiB": null,
   "scores": {
    "textCore": 87.0,
    "textCoreCI": [
     80.9,
     92.8
    ],
    "allSuites": 88.5,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 79.1,
     "finance_extract": 100.0,
     "ts_coding": 77.8,
     "reasoning": 61.1,
     "vision": 100.0,
     "browser_agent": 86.7,
     "agent_e2e": 94.4,
     "repo_qa": 97.2
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 0.7,
    "zh_intent": 11.2,
    "finance_extract": 14.7,
    "ts_coding": 45.8,
    "reasoning": 18.1,
    "vision": 1.4,
    "browser_agent": 3.1,
    "agent_e2e": 6.9,
    "repo_qa": 2.3
   },
   "agentic": null,
   "speed": {
    "decode": 238.5,
    "inTaskDecode": 243.1,
    "ttft": 0.17,
    "firstOutput": 2.9,
    "taskTime": 6.2,
    "prefill": {
     "8k": 15172.0,
     "32k": 15633.0,
     "64k": 13418.0,
     "117k": 10542.0
    },
    "ttftAt": {
     "8k": 0.6,
     "32k": 2.2,
     "64k": 5.1,
     "117k": 11.8
    },
    "decodeAt": {
     "8k": 230.0,
     "32k": 208.0,
     "64k": 173.0,
     "117k": 143.0
    },
    "ctx": 131072,
    "mtp": {
     "on": null,
     "off": null,
     "acceptance": null,
     "draft": null
    }
   },
   "endurance": null,
   "rows": 317
  },
  {
   "id": "qwen36-35b-a3b-cpu",
   "name": "Qwen3.6-35B-A3B",
   "short": "Qwen3.6-35B CPU",
   "variant": "CPU only",
   "vendor": "qwen",
   "params": "35B-A3B",
   "quant": "UD-Q4_K_XL",
   "placement": "cpu",
   "where": "Ryzen 9 9950X3D2",
   "recommended": false,
   "partial": false,
   "speedOnly": true,
   "status": "done",
   "notes": "Speed only: the CPU alone is a fallback, not a daily driver.",
   "vramGiB": null,
   "ramGiB": 34.5,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": {
    "decode": 13.7,
    "inTaskDecode": null,
    "ttft": null,
    "firstOutput": null,
    "taskTime": null,
    "prefill": {
     "8k": 157.0
    },
    "ttftAt": {
     "8k": 52.5
    },
    "decodeAt": {
     "8k": 13.0
    },
    "ctx": 32768,
    "mtp": {
     "on": 13.7,
     "off": null,
     "acceptance": 48.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 0
  },
  {
   "id": "qwen36-35b-a3b-mtp",
   "name": "Qwen3.6-35B-A3B",
   "short": "Qwen3.6-35B MTP",
   "variant": "thinking + MTP",
   "vendor": "qwen",
   "params": "35B-A3B",
   "quant": "UD-Q4_K_XL",
   "placement": "1gpu",
   "where": "RTX 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Fastest decoder here; good for batch jobs and quick answers.",
   "vramGiB": [
    0.0,
    24.9
   ],
   "ramGiB": null,
   "scores": {
    "textCore": 86.5,
    "textCoreCI": [
     80.9,
     91.9
    ],
    "allSuites": 88.0,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 82.1,
     "finance_extract": 100.0,
     "ts_coding": 88.9,
     "reasoning": 55.6,
     "vision": 100.0,
     "browser_agent": 93.3,
     "agent_e2e": 83.3,
     "repo_qa": 88.9
    },
    "repo_replay": 85.2,
    "debug": 80.0,
    "long_horizon": 94.7
   },
   "suiteTimeS": {
    "tool_calling": 0.6,
    "zh_intent": 8.9,
    "finance_extract": 11.5,
    "ts_coding": 34.0,
    "reasoning": 14.1,
    "vision": 1.0,
    "browser_agent": 3.1,
    "agent_e2e": 5.8,
    "repo_qa": 1.4
   },
   "agentic": {
    "repo_replay": {
     "rate": 85.2,
     "runs": 27,
     "tasks": 9,
     "medianWallS": 23.0,
     "medianTimeToCorrectS": 18.0,
     "medianSteps": 15.0
    },
    "debug": {
     "rate": 80.0,
     "runs": 10,
     "tasks": 10,
     "medianWallS": 31.0,
     "medianTimeToFixS": 17.0,
     "reproducedFirst": 70.0,
     "rootCauseNamed": 90.0
    },
    "long_horizon": {
     "rate": 94.7,
     "score": 93.6,
     "sessions": 3,
     "stagesPassed": 18,
     "stagesTotal": 19,
     "recall": 66.7,
     "violations": 1,
     "medianWallMin": 3.1,
     "maxPromptTokens": 101659
    }
   },
   "speed": {
    "decode": 288.4,
    "inTaskDecode": 340.7,
    "ttft": 0.14,
    "firstOutput": 1.9,
    "taskTime": 4.8,
    "prefill": {
     "8k": 13801.0,
     "32k": 13337.0,
     "64k": 11216.0,
     "117k": 8726.0
    },
    "ttftAt": {
     "8k": 0.7,
     "32k": 2.6,
     "64k": 6.0,
     "117k": 14.2
    },
    "decodeAt": {
     "8k": 270.0,
     "32k": 237.0,
     "64k": 222.0,
     "117k": 176.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 288.4,
     "off": 238.5,
     "acceptance": 56.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 280
  },
  {
   "id": "qwen36-35b-a3b-nothink",
   "name": "Qwen3.6-35B-A3B",
   "short": "Qwen3.6-35B no-think",
   "variant": "no thinking",
   "vendor": "qwen",
   "params": "35B-A3B",
   "quant": "UD-Q4_K_XL",
   "placement": "1gpu",
   "where": "RTX 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Answers in about a second; weak on coding and math.",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": 76.9,
    "textCoreCI": [
     68.9,
     84.4
    ],
    "allSuites": 79.4,
    "suites": {
     "tool_calling": 100.0,
     "zh_intent": 79.3,
     "finance_extract": 99.5,
     "ts_coding": 55.6,
     "reasoning": 50.0,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 77.8,
     "repo_qa": 52.8
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 0.5,
    "zh_intent": 0.9,
    "finance_extract": 1.6,
    "ts_coding": 5.8,
    "reasoning": 3.2,
    "vision": 0.4,
    "browser_agent": 2.3,
    "agent_e2e": 3.7,
    "repo_qa": 0.4
   },
   "agentic": null,
   "speed": {
    "decode": 241.9,
    "inTaskDecode": 245.3,
    "ttft": 0.14,
    "firstOutput": 0.1,
    "taskTime": 1.1,
    "prefill": null,
    "ttftAt": null,
    "decodeAt": null,
    "ctx": null,
    "mtp": null
   },
   "endurance": null,
   "rows": 228
  },
  {
   "id": "qwen38-27b-medium",
   "name": "Qwen3.8-27B",
   "short": "Qwen3.8-27B",
   "variant": "dense · effort medium",
   "vendor": "qwen",
   "params": "27B dense",
   "quant": "UD-Q5_K_XL",
   "placement": "1gpu",
   "where": "RTX 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Dense model; strongest on agentic coding (real-repo fixes, debugging, long sessions).",
   "vramGiB": [
    0.0,
    27.5
   ],
   "ramGiB": null,
   "scores": {
    "textCore": 92.8,
    "textCoreCI": [
     87.1,
     97.6
    ],
    "allSuites": 93.6,
    "suites": {
     "tool_calling": 77.8,
     "zh_intent": 92.2,
     "finance_extract": 100.0,
     "ts_coding": 94.4,
     "reasoning": 83.3,
     "vision": 100.0,
     "browser_agent": 100.0,
     "agent_e2e": 94.4,
     "repo_qa": 100.0
    },
    "repo_replay": 100.0,
    "debug": 100.0,
    "long_horizon": 100.0
   },
   "suiteTimeS": {
    "tool_calling": 1.1,
    "zh_intent": 9.9,
    "finance_extract": 6.8,
    "ts_coding": 37.9,
    "reasoning": 32.5,
    "vision": 1.1,
    "browser_agent": 5.2,
    "agent_e2e": 12.5,
    "repo_qa": 2.0
   },
   "agentic": {
    "repo_replay": {
     "rate": 100.0,
     "runs": 27,
     "tasks": 9,
     "medianWallS": 88.0,
     "medianTimeToCorrectS": 81.0,
     "medianSteps": 15.0
    },
    "debug": {
     "rate": 100.0,
     "runs": 10,
     "tasks": 10,
     "medianWallS": 60.0,
     "medianTimeToFixS": 36.0,
     "reproducedFirst": 80.0,
     "rootCauseNamed": 100.0
    },
    "long_horizon": {
     "rate": 100.0,
     "score": 100.0,
     "sessions": 3,
     "stagesPassed": 19,
     "stagesTotal": 19,
     "recall": 100.0,
     "violations": 0,
     "medianWallMin": 4.0,
     "maxPromptTokens": 53474
    }
   },
   "speed": {
    "decode": 133.6,
    "inTaskDecode": 156.5,
    "ttft": 0.35,
    "firstOutput": 2.0,
    "taskTime": 6.1,
    "prefill": {
     "8k": 3650.0,
     "32k": 3383.0,
     "64k": 2962.0,
     "117k": 2475.0
    },
    "ttftAt": {
     "8k": 2.4,
     "32k": 10.1,
     "64k": 22.6,
     "117k": 49.6
    },
    "decodeAt": {
     "8k": 140.0,
     "32k": 117.0,
     "64k": 100.0,
     "117k": 76.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 133.6,
     "off": null,
     "acceptance": 56.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 341
  },
  {
   "id": "step37flash-2gpu",
   "name": "Step-3.7-Flash",
   "short": "Step-3.7-Flash",
   "variant": "IQ4_XS · both GPUs",
   "vendor": "stepfun",
   "params": "198B MoE",
   "quant": "UD-IQ4_XS",
   "placement": "2gpu",
   "where": "PRO 6000 + 5090",
   "recommended": false,
   "partial": false,
   "speedOnly": false,
   "status": "done",
   "notes": "Several reasoning and coding answers looped until the 32K token limit.",
   "vramGiB": [
    76.8,
    25.5
   ],
   "ramGiB": 4.1,
   "scores": {
    "textCore": 82.8,
    "textCoreCI": [
     73.7,
     91.1
    ],
    "allSuites": 82.8,
    "suites": {
     "tool_calling": 83.3,
     "zh_intent": 78.7,
     "finance_extract": 100.0,
     "ts_coding": 66.7,
     "reasoning": 50.0,
     "vision": null,
     "browser_agent": 100.0,
     "agent_e2e": 100.0,
     "repo_qa": 83.3
    },
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": {
    "tool_calling": 0.8,
    "zh_intent": 50.0,
    "finance_extract": 17.1,
    "ts_coding": 169.8,
    "reasoning": 151.2,
    "vision": null,
    "browser_agent": 4.4,
    "agent_e2e": 15.1,
    "repo_qa": 1.8
   },
   "agentic": null,
   "speed": {
    "decode": 129.8,
    "inTaskDecode": 152.4,
    "ttft": 0.28,
    "firstOutput": 5.2,
    "taskTime": 12.4,
    "prefill": {
     "8k": 4183.0,
     "32k": 4107.0,
     "64k": 3712.0,
     "117k": 3181.0
    },
    "ttftAt": {
     "8k": 2.0,
     "32k": 8.3,
     "64k": 18.1,
     "117k": 39.0
    },
    "decodeAt": {
     "8k": 142.0,
     "32k": 151.0,
     "64k": 122.0,
     "117k": 96.0
    },
    "ctx": 131072,
    "mtp": {
     "on": 129.8,
     "off": null,
     "acceptance": 53.0,
     "draft": 3
    }
   },
   "endurance": null,
   "rows": 74
  },
  {
   "id": "minimax31flash-hybrid",
   "name": "MiniMax-M3.1-Flash",
   "short": "MiniMax-M3.1-Flash",
   "variant": "Q2 · GPUs + RAM",
   "vendor": "minimax",
   "params": "428B-A23B",
   "quant": "UD-Q2_K_XL",
   "placement": "hybrid",
   "where": "2 GPUs + 128 GB RAM",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "queued",
   "notes": "Experts that don't fit in VRAM are memory-mapped from RAM.",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "deepseek41-rco-hybrid",
   "name": "DeepSeek-V4.1-Flash",
   "short": "DeepSeek-V4.1-Flash",
   "variant": "IQ2_XXS · GPUs + RAM",
   "vendor": "deepseek",
   "params": "763B-A16B",
   "quant": "GSQ-RCO IQ2_XXS",
   "placement": "hybrid",
   "where": "2 GPUs + RAM + SSD",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "queued",
   "notes": "All experts; Engram table on NVMe.",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "glm53flash-q4-hybrid",
   "name": "GLM-5.3-Flash",
   "short": "GLM-5.3-Flash Q4",
   "variant": "Q4 · GPUs + RAM",
   "vendor": "zai",
   "params": "321B-A18B",
   "quant": "UD-Q4_K_XL",
   "placement": "hybrid",
   "where": "2 GPUs + RAM",
   "recommended": false,
   "partial": false,
   "speedOnly": true,
   "status": "queued",
   "notes": "",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "glm53slim-hybrid",
   "name": "GLM-5.3",
   "short": "GLM-5.3 SLIM",
   "variant": "SLIM IQ2_M · GPUs + RAM",
   "vendor": "zai",
   "params": "753B-A40B (192/256 experts)",
   "quant": "UD-IQ2_M-E192",
   "placement": "hybrid",
   "where": "2 GPUs + RAM",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "waiting",
   "notes": "",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "glm53-iq1s-hybrid",
   "name": "GLM-5.3",
   "short": "GLM-5.3 IQ1",
   "variant": "IQ1_S · GPUs + RAM",
   "vendor": "zai",
   "params": "753B-A40B",
   "quant": "UD-IQ1_S",
   "placement": "hybrid",
   "where": "2 GPUs + RAM",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "waiting",
   "notes": "",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "ling31flash-hybrid",
   "name": "Ling-3.1-flash",
   "short": "Ling-3.1-flash",
   "variant": "IQ2_M · GPUs + RAM",
   "vendor": "ant",
   "params": "572B-A25B",
   "quant": "AD-IQ2_M",
   "placement": "hybrid",
   "where": "2 GPUs + RAM",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "waiting",
   "notes": "",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "kimik3-reap55-stream",
   "name": "Kimi-K3",
   "short": "Kimi-K3",
   "variant": "REAP IQ1_M · streamed",
   "vendor": "moonshot",
   "params": "2.78T-A104B (400/896 experts)",
   "quant": "IQ1_M",
   "placement": "stream",
   "where": "2 GPUs + RAM + 2 NVMe",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "waiting",
   "notes": "",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  },
  {
   "id": "glm53-iq4xs-stream",
   "name": "GLM-5.3",
   "short": "GLM-5.3 IQ4",
   "variant": "IQ4_XS · streamed",
   "vendor": "zai",
   "params": "753B-A40B",
   "quant": "UD-IQ4_XS",
   "placement": "stream",
   "where": "2 GPUs + RAM + 2 NVMe",
   "recommended": false,
   "partial": true,
   "speedOnly": true,
   "status": "waiting",
   "notes": "",
   "vramGiB": null,
   "ramGiB": null,
   "scores": {
    "textCore": null,
    "textCoreCI": null,
    "allSuites": null,
    "suites": null,
    "repo_replay": null,
    "debug": null,
    "long_horizon": null
   },
   "suiteTimeS": null,
   "agentic": null,
   "speed": null,
   "endurance": null,
   "rows": 0
  }
 ],
 "mtpSweep": {
  "model": "Qwen3.8-Flash-Next Q4 · RTX PRO 6000",
  "points": [
   {
    "draft": 0,
    "tps": 104.1
   },
   {
    "draft": 2,
    "tps": 155.5
   },
   {
    "draft": 3,
    "tps": 155.6
   },
   {
    "draft": 4,
    "tps": 161.8
   }
  ]
 },
 "nvme": [
  {
   "drive": "C: Samsung 990 EVO Plus 4 TB",
   "seq": 5.32,
   "rand2m": 3.7,
   "rand256k": 2.14,
   "rand64k": 0.87
  },
  {
   "drive": "D: KIOXIA XG10 512 GB",
   "seq": 3.58,
   "rand2m": 3.57,
   "rand256k": 3.57,
   "rand64k": 3.55
  },
  {
   "drive": "Both at once",
   "seq": null,
   "rand2m": 7.34,
   "rand256k": 5.75,
   "rand64k": null
  }
 ],
 "hardwareFindings": [
  {
   "title": "One model per GPU",
   "verdict": "recommended",
   "metric": "156 tok/s",
   "body": "Qwen3.8-Flash-Next Q4 on the PRO 6000 while the 5090 runs a second model: about 4% slower than alone."
  },
  {
   "title": "One model across both GPUs",
   "verdict": "works",
   "metric": "96-135 tok/s",
   "body": "Layer split fits 200-320B models (GLM-5.3-Flash, MiMo, Step, Q5) but none beat the single-GPU Q4."
  },
  {
   "title": "Tensor parallel (-sm tensor)",
   "verdict": "avoid",
   "metric": "crash",
   "body": "Crashes on GLM-5.3-Flash in this llama.cpp build (unsupported tensor view); layer split only."
  },
  {
   "title": "CPU only",
   "verdict": "avoid",
   "metric": "14-19 tok/s",
   "body": "Qwen3.6-35B-A3B on 16 Zen 5 cores: 157 tok/s prefill. The CPU's real job is hosting MoE experts."
  },
  {
   "title": "Big lookup tables on SSD",
   "verdict": "recommended",
   "metric": "105 tok/s",
   "body": "DeepSeek-V4.1's 111 GB Engram table stays on NVMe (read one row per token): a 763B-class model on one GPU with ~8 GB of RAM."
  },
  {
   "title": "Two NVMe drives in parallel",
   "verdict": "works",
   "metric": "7.3 GB/s",
   "body": "3.7 + 3.6 GB/s for 2 MB random reads. Splitting a streamed model across both drives doubles read speed."
  },
  {
   "title": "MTP speculative decoding",
   "verdict": "recommended",
   "metric": "x1.5",
   "body": "Built-in multi-token prediction: 104 tok/s without, 156-162 tok/s with draft length 2-4."
  },
  {
   "title": "Windows commit limit",
   "verdict": "works",
   "metric": "pagefile",
   "body": "WDDM charges VRAM to system commit: a 90 GB model needs a large fixed pagefile, even with 128 GB of RAM."
  }
 ],
 "pairs": [
  [
   "flashnext-q4-1gpu-medium",
   "flashnext-q5-2gpu-medium"
  ],
  [
   "flashnext-q4-1gpu-medium",
   "glm53flash-q2-2gpu"
  ],
  [
   "flashnext-q4-1gpu-medium",
   "deepseek41-coder-6000"
  ],
  [
   "flashnext-q4-1gpu-medium",
   "qwen38-27b-medium"
  ],
  [
   "qwen38-27b-medium",
   "qwen36-35b-a3b-mtp"
  ],
  [
   "mimo26flash-2gpu",
   "step37flash-2gpu"
  ],
  [
   "glm53flash-q2-2gpu",
   "glm47flash-5090"
  ],
  [
   "inkling2mini-5090",
   "qwen36-35b-a3b-mtp"
  ]
 ],
 "verdict": {
  "pick": "flashnext-q4-1gpu-medium",
  "en": "Qwen3.8-Flash-Next Q4 on the RTX PRO 6000 is the daily driver: top-tier quality (96.1 text core, tied within error with Q5 and GLM-5.3-Flash), the fastest of the top tier (163 tok/s, 5.2 s per task), and it leaves the RTX 5090 free for a second model.",
  "zh": "主力：Qwen3.8-Flash-Next Q4，单卡 RTX PRO 6000。质量第一梯队（文本核心 96.1），速度最快（163 tok/s，单题 5.2 秒），5090 空出来跑第二个模型。"
 },
 "methodology": [
  {
   "title": "Same tasks for every model",
   "body": "The headline score uses the first 6 tasks of every suite (59 tasks), intersected across models, so every model answers exactly the same questions. Partial runs are scored on the subset they finished."
  },
  {
   "title": "Text core = ranking metric",
   "body": "Mean of the 8 text suites' scores (vision excluded, so text-only models compete on equal terms). 95% confidence intervals come from a task-level bootstrap; overlapping intervals mean the gap is noise."
  },
  {
   "title": "Graded by code, not by a judge model",
   "body": "Hidden unit tests, exact numeric answers, field-level JSON matching and real test suites. No LLM judge."
  },
  {
   "title": "Agentic suites are separate",
   "body": "Real-repo bug fixes, debugging and long sessions run real tools in scratch clones with a sandbox that blocks network, child processes and writes outside the working copy. They are reported apart from the core score."
  },
  {
   "title": "Speed is measured on this PC",
   "body": "Decode = short prompts with the model's speculative decoding on; prefill and TTFT measured at 8K-117K tokens of context; task time = median wall time per core task, thinking included."
  },
  {
   "title": "Private data stays private",
   "body": "The tasks come from the owner's real work, so only aggregate scores are published here: no prompts, answers, task ids, account or institution names."
  }
 ]
};
