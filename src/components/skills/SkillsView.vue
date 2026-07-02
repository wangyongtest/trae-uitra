<script setup lang="ts">
// 技能/工具视图 - 占位组件
// 后续可以扩展为工具调用配置、技能管理等功能
</script>

<template>
  <div class="h-full overflow-y-auto custom-scrollbar p-6">
    <div class="max-w-4xl mx-auto">
      <!-- 页面标题 -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-dark-100">技能与工具</h1>
        <p class="text-dark-400 mt-1">管理可用的AI工具和技能</p>
      </div>

      <!-- 占位内容 -->
      <div class="bg-dark-800 rounded-xl border border-dark-700 p-12 text-center">
        <div class="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-dark-200 mb-2">技能管理</h2>
        <p class="text-dark-400 max-w-md mx-auto">
          这里将展示可用的工具列表，包括代码搜索、文件操作、网络请求等功能。
          您可以启用或禁用特定工具，配置工具权限。
        </p>
      </div>

      <!-- 工具列表占位 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div
          v-for="tool in [
            { name: '代码搜索', desc: '在代码库中搜索代码片段', icon: '🔍', enabled: true },
            { name: '文件读取', desc: '读取本地文件内容', icon: '📄', enabled: true },
            { name: '文件写入', desc: '创建或修改文件', icon: '✏️', enabled: true },
            { name: '终端执行', desc: '执行shell命令', icon: '💻', enabled: false },
            { name: '网络请求', desc: '发送HTTP请求', icon: '🌐', enabled: true },
            { name: '知识库', desc: '访问文档知识库', icon: '📚', enabled: true }
          ]"
          :key="tool.name"
          class="bg-dark-800 rounded-xl border border-dark-700 p-4"
        >
          <div class="flex items-start justify-between">
            <div class="text-2xl">{{ tool.icon }}</div>
            <div
              class="w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer"
              :class="tool.enabled ? 'bg-primary-600' : 'bg-dark-600'"
            >
              <div
                class="w-4 h-4 bg-white rounded-full transition-transform"
                :class="tool.enabled ? 'translate-x-5' : 'translate-x-0'"
              ></div>
            </div>
          </div>
          <h3 class="font-medium text-dark-100 mt-3">{{ tool.name }}</h3>
          <p class="text-sm text-dark-400 mt-1">{{ tool.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
