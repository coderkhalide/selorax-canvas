import { MCPServer }   from '@mastra/mcp';
import * as tools      from '../tools';
import { canvasAgent } from '../agents/canvas-agent';

// tenant_id is REQUIRED in every tool — enforces isolation across tenants
export const seloraxMcp = new MCPServer({
  name: 'selorax-canvas', version: '1.0.0',
  tools: {
    getPageTree:           tools.getPageTreeTool,
    getNode:               tools.getNodeTool,
    getNodeChildren:       tools.getNodeChildrenTool,
    findNodes:             tools.findNodesTool,
    insertNode:            tools.insertNodeTool,
    updateNodeStyles:      tools.updateNodeStylesTool,
    updateNodeProps:       tools.updateNodePropsTool,
    updateNodeSettings:    tools.updateNodeSettingsTool,
    moveNode:              tools.moveNodeTool,
    deleteNode:            tools.deleteNodeTool,
    searchComponents:      tools.searchComponentsTool,
    getComponent:          tools.getComponentTool,
    buildComponent:        tools.buildComponentTool,
    injectComponent:       tools.injectComponentTool,
    listPages:             tools.listPagesTool,
    publishPage:           tools.publishPageTool,
    getAnalytics:          tools.getAnalyticsTool,
    getCanvasScreenshot:   tools.getCanvasScreenshot,
    createPage:            tools.createPageTool,
    duplicatePage:         tools.duplicatePageTool,
    renamePage:            tools.renamePageTool,
    listFunnels:           tools.listFunnelsTool,
    createFunnel:          tools.createFunnelTool,
    updateFunnelSteps:     tools.updateFunnelStepsTool,
    createExperiment:      tools.createExperimentTool,
    activateExperiment:    tools.activateExperimentTool,
    getExperimentResults:  tools.getExperimentResultsTool,
    get_page_analytics:    tools.getPageAnalyticsTool,
  },
  agents: { canvasAgent },
});
