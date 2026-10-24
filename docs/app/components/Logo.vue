<script setup lang="ts">
defineOptions({ name: 'StorylineLogo' })
const { app } = useRuntimeConfig()
const logoSrc = `${app.baseURL}logo.png`
</script>

<template>
  <img :src="logoSrc" alt="Störyline Logo" class="h-auto w-auto" />
</template>
