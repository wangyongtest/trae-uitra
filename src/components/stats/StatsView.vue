<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { use } from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'
import { useStatsStore } from '@/stores/stats'
import CacheHitMonitor from './CacheHitMonitor.vue'

use([
  LineChart,
  PieChart,
  CanvasRenderer,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const statsStore = useStatsStore()

// 缓存命中率折线图配置
const hitRateChartOption = computed(() => {
  const history = statsStore.cacheStats.history.slice(-50)
  const times = history.map(h => dayjs(h.timestamp).format('HH:mm'))
  const rates = history.map(h => (h.hitRate * 100).toFixed(1))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
      formatter: (params: any) => {
        const data = params[0]
        return `${data.name}<br/>命中率: ${data.value}%`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisLabel: { color: '#64748b', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#334155', type: 'dashed' } }
    },
    series: [
      {
        name: '命中率',
        type: 'line',
        data: rates,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#3b82f6', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        }
      }
    ]
  }
})

// 模型使用占比饼图配置
const modelUsageOption = computed(() => {
  const costByModel = statsStore.costStats.costByModel
  const data = Object.entries(costByModel).map(([name, value]) => ({
    name: name === 'deepseek-chat' ? 'DeepSeek V3' : name === 'doubao-pro' ? '豆包 Pro' : name,
    value: parseFloat((value as number).toFixed(4))
  }))

  if (data.length === 0) {
    data.push({ name: '暂无数据', value: 1 })
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
      formatter: '{b}: ${c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#94a3b8' }
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#1e293b',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#f1f5f9'
          }
        },
        labelLine: { show: false },
        data: data.length > 0 ? data : [{ name: '暂无数据', value: 1, itemStyle: { color: '#475569' } }],
        color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
      }
    ]
  }
})

// 预算使用百分比
const budgetPercent = computed(() => {
  const { dailyBudget, todayUsed } = statsStore.costStats.budgetAlert
  if (dailyBudget <= 0) return 0
  return Math.min((todayUsed / dailyBudget) * 100, 100)
})

// 预算进度条颜色
const budgetColor = computed(() => {
  if (budgetPercent.value >= 90) return 'bg-red-500'
  if (budgetPercent.value >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
})

// 缓存状态颜色
const cacheStatusColor = computed(() => {
  const status = statsStore.cacheStats.status
  if (status === 'green') return 'text-green-500'
  if (status === 'yellow') return 'text-yellow-500'
  return 'text-red-500'
})

const cacheStatusText = computed(() => {
  const status = statsStore.cacheStats.status
  if (status === 'green') return '优秀'
  if (status === 'yellow') return '良好'
  return '需优化'
})

// 是否显示优化建议
const showSuggestions = computed(() => statsStore.cacheStats.hitRate < 0.7)

onMounted(() => {
  statsStore.startAutoRefresh(5000)
})

onUnmounted(() => {
  statsStore.stopAutoRefresh()
})
</script>

<template>
  <div class="h-full overflow-y-auto custom-scrollbar p-6">
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- 页面标题 -->
      <div>
        <h1 class="text-2xl font-bold text-dark-100">统计监控</h1>
        <p class="text-dark-400 mt-1">缓存命中率与费用消耗实时监控</p>
      </div>

      <!-- 顶部统计卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 缓存命中率 -->
        <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-dark-400 text-sm">缓存命中率</span>
            <span :class="cacheStatusColor" class="text-sm font-medium">{{ cacheStatusText }}</span>
          </div>
          <div class="text-3xl font-bold" :class="cacheStatusColor">
            {{ (statsStore.cacheStats.hitRate * 100).toFixed(1) }}%
          </div>
        </div>

        <!-- 今日费用 -->
        <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-dark-400 text-sm">今日消费</span>
            <svg class="w-5 h-5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="text-3xl font-bold text-dark-100">
            ${{ statsStore.costStats.todayCost.toFixed(4) }}
          </div>
        </div>

        <!-- 累计费用 -->
        <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-dark-400 text-sm">累计消费</span>
            <svg class="w-5 h-5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div class="text-3xl font-bold text-dark-100">
            ${{ statsStore.costStats.totalCost.toFixed(4) }}
          </div>
        </div>

        <!-- 预算进度 -->
        <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-dark-400 text-sm">今日预算</span>
            <span class="text-sm text-dark-300">
              ${{ statsStore.costStats.budgetAlert.todayUsed.toFixed(4) }} / ${{ statsStore.costStats.budgetAlert.dailyBudget.toFixed(2) }}
            </span>
          </div>
          <div class="mt-3">
            <div class="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="budgetColor"
                :style="{ width: budgetPercent + '%' }"
              ></div>
            </div>
            <div class="text-right text-xs mt-1" :class="budgetPercent >= 80 ? 'text-red-400' : 'text-dark-500'">
              {{ budgetPercent.toFixed(1) }}%
            </div>
          </div>
        </div>
      </div>

      <!-- 缓存命中监控 -->
      <CacheHitMonitor :stats="statsStore.cacheStats" />

      <!-- 图表区域 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 命中率趋势图 -->
        <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <h3 class="text-lg font-semibold text-dark-100 mb-4">命中率趋势</h3>
          <div class="h-72">
            <VChart :option="hitRateChartOption" autoresize />
          </div>
        </div>

        <!-- 模型使用占比 -->
        <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <h3 class="text-lg font-semibold text-dark-100 mb-4">模型费用占比</h3>
          <div class="h-72">
            <VChart :option="modelUsageOption" autoresize />
          </div>
        </div>
      </div>

      <!-- 优化建议 -->
      <div v-if="showSuggestions" class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
        <div class="flex gap-3">
          <svg class="w-6 h-6 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 class="font-semibold text-yellow-500 mb-2">优化建议</h4>
            <ul class="text-sm text-dark-300 space-y-1 list-disc list-inside">
              <li>当前缓存命中率较低（< 70%），建议复用相似的对话前缀以提高缓存命中率</li>
              <li>对于长对话，可以考虑使用支持上下文缓存的模型（如DeepSeek V3）</li>
              <li>减少重复的系统提示和上下文，有助于提升缓存效果</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
