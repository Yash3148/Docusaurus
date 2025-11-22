import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // DevOps Documentation Sidebar
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Ariba DevOps',
      items: [
        'Ariba DevOps/intro',
        'Ariba DevOps/aks-terraform-deployment',
        'Ariba DevOps/azure-functions-powershell',
        'Ariba DevOps/bluetooth-ble-troubleshooting',
        'Ariba DevOps/azure-devops-security-pipeline',
      ],
    },
    {
      type: 'category',
      label: 'CN Org Structure',
      items: [
        'CN Org Structure/organizational-structure',
      ],
    },
  ],
};

export default sidebars;
