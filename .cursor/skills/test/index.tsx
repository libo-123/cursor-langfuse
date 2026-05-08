const data = {
  data: [
    {
      name: "测试提示词",
      tags: [],
      lastUpdatedAt: "2026-05-08T08:52:23.238Z",
      versions: [1],
      labels: ["latest", "production"],
      lastConfig: {},
    },
  ],
  meta: { page: 1, limit: 10, totalPages: 1, totalItems: 1 },
  pagination: { page: 1, limit: 10, totalPages: 1, totalItems: 1 },
};

const data2 = {
  ok: true,
  status: 200,
  body: {
    id: "8fa0abd3-d39c-4dae-8d06-279eea952147",
    createdAt: "2026-05-08T08:52:23.238Z",
    updatedAt: "2026-05-08T08:52:23.238Z",
    projectId: "cmo8fhe7q04yjd7fp5idi6bnc",
    createdBy: "cmo1aq9zg017cd7fpflwwqzs7",
    prompt: "这是一个测试提示词，用于测试Prompt Management功能是否正确运行！",
    name: "测试提示词",
    version: 1,
    type: "text",
    isActive: null,
    config: {},
    tags: [],
    labels: ["production", "latest"],
    commitMessage: null,
    resolutionGraph: null,
  },
};