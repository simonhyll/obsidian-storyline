export default defineAppConfig({
  ui: {
    colors: {
      primary: 'amber',
      neutral: 'slate'
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },
  seo: {
    siteName: 'Störyline'
  },
  header: {
    title: 'Störyline',
    to: '/',
    logo: {
      alt: 'Störyline',
      light: '',
      dark: ''
    },
    search: true,
    colorMode: true,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/simonhyll/obsidian-storyline',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  },
  footer: {
    credits: `Störyline • © ${new Date().getFullYear()}`,
    colorMode: false,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/simonhyll/obsidian-storyline',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Contribute',
      edit: 'https://github.com/simonhyll/obsidian-storyline/edit/main/docs/content',
      links: [{
        icon: 'i-lucide-star',
        label: 'Star on GitHub',
        to: 'https://github.com/simonhyll/obsidian-storyline',
        target: '_blank'
      }]
    }
  }
})
