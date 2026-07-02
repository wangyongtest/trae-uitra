<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { TitleComponent, TooltipComponent } from 'echarts/components'
import dayjs from 'dayjs'
import type { CacheStats } from '@/types'

use([GaugeChart, CanvasRenderer, TitleComponent, TooltipComponent])

interface Props {
  stats: CacheStats
}

const props = defineProps<Props>()

// 仪表盘配置
const gaugeOption = computed(() => {
  const hitRate = (props.stats.hitRate * 100).toFixed(1)
  let color = '#22c55e'
  if (props.stats.hitRate < 0.5) color = '#ef4444'
  else if (props.stats.hitRate < 0.7) color = '#eab308'

  return {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: {
          color: color
        },
        progress: {
          show: true,
          width: 20
        },
        pointer: {
          show: true,
          length: '60%',
          width: 5
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#334155']]
          }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        title: {
          show: false
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 40,
          borderRadius: 8,
          offsetCenter: [0, '10%'],
          fontSize: 28,
          fontWeight: 'bold',
          formatter: '{value}%',
          color: color
        },
        data: [
          {
            value: parseFloat(hitRate)
          }
        ]
      }
    ]
  }
})

// 未命中Token
const missedTokens = computed(() => props.stats.totalPrompt - props.stats.totalHit)

// 最近20轮历史数据
const recentHistory = computed(() => props.stats.history.slice(-20).reverse())
</script>

<template>
  <div class="bg-dark-800 rounded-xl border border-dark-700 p-5">
    <h3 class="text-lg font-semibold text-dark-100 mb-4">缓存命中监控</h3>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 左侧：环形图 -->
      <div class="flex flex-col items-center">
        <div class="w-64 h-64">
          <VChart :option="gaugeOption" autoresize />
        </div>

        <!-- Token对比 -->
        <div class="grid grid-cols-2 gap-4 w-full mt-4">
          <div class="bg-dark-900 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-green-500">
              {{ (stats.totalHit / 1000).toFixed(1) }}K
            </div>
            <div class="text-xs text-dark-400 mt-1">命中Token</div>
          </div>
          <div class="bg-dark-900 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-dark-300">
              {{ (missedTokens / 1000).toFixed(1) }}K
            </div>
            <div class="text-xs text-dark-400 mt-1">未命中Token</div>
          </div>
        </div>
      </div>

      <!-- 右侧：历史表格 -->
      <div class="overflow-hidden">
        <div class="text-sm text-dark-400 mb-2">最近20轮</div>
        <div class="overflow-y-auto max-h-80 custom-scrollbar">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-dark-800">
              <tr class="text-dark-500 text-left">
                <th class="pb-2 font-medium">时间</th>
                <th class="pb-2 font-medium">命中率</th>
                <th class="pb-2 font-medium">Token</th>
                <th class="pb-2 font-medium">费用</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(round, index) in recentHistory"
                :key="index"
                class="border-t border-dark-700/50"
              >
                <td class="py-2 text-dark-400">
                  {{ dayjs(round.timestamp).format('HH:mm:ss') }}
                </td>
                <td class="py-2">
                  <span
                    :class="round.hitRate >= 0.7 ? 'text-green-500' : round.hitRate >= 0.5 ? 'text-yellow-500' : 'text-red-500'"
                  >
                    {{ (round.hitRate * 100).toFixed(1) }}%
                  </span>
                </td>
                <td class="py-2 text-dark-400">
                  {{ round.promptTokens }} / {{ round.cachedTokens }}
                </td>
                <td class="py-2 text-dark-400">
                  ${{ round.cost.toFixed(4) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
