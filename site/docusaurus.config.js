// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Preevy',
  tagline: 'Provision preview environments with minimal configuration',
  favicon: 'img/favicon.svg',

  // Set the production url of your site here
  url: 'https://preevy.dev',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/livecycle/preevy/tree/main/site',
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }],
            [require('./extract-markdown-section'), {}],
          ],
          // beforeDefaultRemarkPlugins: [
          //   [require('./extract-markdown-section'), {}],
          // ],
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig:
  /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      algolia: {
        // The application ID provided by Algolia
        appId: 'IYPBFAAVY7',
        // Public API key: it is safe to commit it
        apiKey: '397d04c17bc3b5453a0892c14aa25f5d',
        indexName: 'preevy',
        // Optional: see doc section below
        contextualSearch: true,
        // Optional: Algolia search parameters
        searchParameters: {},
        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: 'search',
      },
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Preevy',
        logo: {
          alt: '',
          src: 'img/logo-light.svg',
          srcDark: 'img/logo-dark.svg',
          width: 32,
          height: 32,
        },
        items: [
          {
            href: 'https://github.com/livecycle/preevy',
            position: 'right',
            className: 'header-github-link',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} Preevy by <a href="https://livecycle.io/">Livecycle</a>`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      /** @type {import('@docusaurus/plugin-client-redirects').Options} */
      {
        redirects: [
          // {
          //   from: '/integrations/github-plugin.md',
          //   to: '/ci-integration/.md',
          // },
        ],
        createRedirects: existingPath => {
          if (existingPath.startsWith('/deploy-runtimes/')) {
            return existingPath.replace('/deploy-runtimes/', '/drivers/')
          }

          return undefined
        }
      },
    ],
  ],
}

module.exports = config
