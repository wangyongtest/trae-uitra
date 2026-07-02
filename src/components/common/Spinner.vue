<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'currentColor'
})

// 计算尺寸
const sizeMap = {
  sm: 16,
  md: 24,
  lg: 40
}

const dimension = computed(() => sizeMap[props.size])
const strokeWidth = computed(() => props.size === 'sm' ? 2 : props.size === 'lg' ? 3 : 2.5)
</script>

<template>
  <svg
    class="animate-spin"
    :width="dimension"
    :height="dimension"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      :stroke="color"
      stroke-opacity="0.25"
      :stroke-width="strokeWidth"
    />
    <path
      d="M12 2C6.47715 2 2 6.47715 2 12"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
    />
  </svg>
</template>
