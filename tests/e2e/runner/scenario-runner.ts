import { Page, expect } from '@playwright/test';
import { SELECTORS } from '../selectors';
import { TestReporter, takeScreenshot, uploadTestFile, measurePerformance, resizeViewport } from '../utils/test-helpers';

interface TestStep {
  action: string;
  selector?: string;
  params?: Record<string, unknown>;
  saveAs?: string;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectedResult?: string;
}

interface TestScenarioFile {
  name: string;
  description: string;
  priority: string;
  tags: string[];
  timeout?: number;
  requiresFile?: boolean;
  scenarios: TestScenario[];
}

interface ExecutionContext {
  page: Page;
  variables: Record<string, unknown>;
  reporter: TestReporter;
}

export class ScenarioRunner {
  private context: ExecutionContext;

  constructor(page: Page) {
    this.context = {
      page,
      variables: {},
      reporter: new TestReporter(),
    };
  }

  async runScenarioFile(scenarioFile: TestScenarioFile): Promise<TestReporter> {
    console.log(`\n📋 Running: ${scenarioFile.name}`);
    console.log(`   Tags: ${scenarioFile.tags.join(', ')}`);
    
    for (const scenario of scenarioFile.scenarios) {
      await this.runScenario(scenario);
    }
    
    return this.context.reporter;
  }

  async runScenario(scenario: TestScenario): Promise<boolean> {
    console.log(`\n  ▶️  ${scenario.id}: ${scenario.name}`);
    
    let allStepsPassed = true;
    const startTime = Date.now();
    
    for (const step of scenario.steps) {
      const stepStart = Date.now();
      try {
        await this.executeStep(step);
        const duration = Date.now() - stepStart;
        
        this.context.reporter.addResult({
          scenario: scenario.name,
          step: `${step.action}${step.selector ? ` (${step.selector})` : ''}`,
          status: 'pass',
          duration,
        });
        
        console.log(`     ✓ ${step.action} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - stepStart;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.context.reporter.addResult({
          scenario: scenario.name,
          step: `${step.action}${step.selector ? ` (${step.selector})` : ''}`,
          status: 'fail',
          duration,
          error: errorMessage,
        });
        
        console.log(`     ✗ ${step.action}: ${errorMessage}`);
        allStepsPassed = false;
        break;
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`     ${allStepsPassed ? '✅' : '❌'} ${scenario.name} (${totalDuration}ms)`);
    
    return allStepsPassed;
  }

  private async executeStep(step: TestStep): Promise<void> {
    const { page, variables } = this.context;
    
    switch (step.action) {
      case 'goto':
        await page.goto((step.params?.url as string) || '/');
        break;
        
      case 'waitForLoadState':
        await page.waitForLoadState((step.params?.state as 'load' | 'domcontentloaded' | 'networkidle') || 'networkidle');
        break;
        
      case 'waitForTimeout':
        await page.waitForTimeout((step.params?.ms as number) || 500);
        break;
        
      case 'expectVisible':
        await expect(this.resolveSelector(step.selector!)).toBeVisible();
        break;
        
      case 'expectHidden':
        await expect(this.resolveSelector(step.selector!)).toBeHidden();
        break;
        
      case 'click':
        if (step.params?.index !== undefined) {
          await this.resolveSelector(step.selector!).nth(step.params.index as number).click();
        } else {
          await this.resolveSelector(step.selector!).click();
        }
        break;
        
      case 'fill':
        await this.resolveSelector(step.selector!).fill(step.params?.value as string);
        break;
        
      case 'pressKey':
        await page.keyboard.press(step.params?.key as string);
        break;
        
      case 'scroll':
        await page.mouse.wheel(0, (step.params?.y as number) || 0);
        break;
        
      case 'screenshot':
        await takeScreenshot(page, step.params?.name as string);
        break;
        
      case 'uploadFile':
        await uploadTestFile(page, step.params?.file as string);
        break;
        
      case 'getText':
        const text = await this.resolveSelector(step.selector!).textContent() || '';
        if (step.saveAs) variables[step.saveAs] = text;
        break;
        
      case 'count':
        const count = await this.resolveSelector(step.selector!).count();
        if (step.saveAs) variables[step.saveAs] = count;
        break;
        
      case 'getBoundingBox':
        const box = await this.resolveSelector(step.selector!).boundingBox();
        if (step.saveAs) variables[step.saveAs] = box;
        break;
        
      case 'evaluate':
        const result = await page.evaluate(step.params?.script as string);
        if (step.saveAs) variables[step.saveAs] = result;
        break;
        
      case 'setViewport':
        await resizeViewport(page, step.params?.width as number, step.params?.height as number);
        break;
        
      case 'measurePerformance':
        const perf = await measurePerformance(
          page,
          async () => {
            for (let i = 0; i < 10; i++) {
              await page.mouse.wheel(0, 500);
              await page.waitForTimeout(50);
            }
          },
          (step.params?.iterations as number) || 5
        );
        if (step.saveAs) variables[step.saveAs] = perf;
        break;
        
      case 'assert':
        await this.evaluateCondition(step.params?.condition as string);
        break;
        
      case 'drag':
        const fromIndex = step.params?.fromIndex as number;
        const toIndex = step.params?.toIndex as number;
        const elements = this.resolveSelector(step.selector!);
        const fromBox = await elements.nth(fromIndex).boundingBox();
        const toBox = await elements.nth(toIndex).boundingBox();
        if (fromBox && toBox) {
          await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
          await page.mouse.up();
        }
        break;
        
      case 'clickCanvas':
        const canvas = this.resolveSelector(step.selector!);
        const canvasBox = await canvas.boundingBox();
        if (canvasBox) {
          const x = step.params?.x === 'center' ? canvasBox.width / 2 : step.params?.x;
          const y = step.params?.y;
          await page.mouse.click(canvasBox.x + (x as number), canvasBox.y + (y as number));
        }
        break;
        
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  private resolveSelector(selectorPath: string): import('@playwright/test').Locator {
    const { page } = this.context;
    
    // Handle dot notation for nested selectors
    const parts = selectorPath.split('.');
    
    // Check if it's a predefined selector
    if (parts[0] in SELECTORS) {
      let current: unknown = SELECTORS;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      
      if (typeof current === 'string') {
        return page.locator(current);
      }
    }
    
    // Fallback to direct selector
    return page.locator(selectorPath);
  }

  private async evaluateCondition(condition: string): Promise<void> {
    const { variables } = this.context;
    
    // Simple condition evaluation
    // Supports: variableName operator value
    // e.g., "newCount >= initialCount", "canvasBox.width > 0"
    const sanitizedCondition = condition.replace(/(\w+)/g, (match) => {
      if (match in variables) {
        return JSON.stringify(variables[match]);
      }
      return match;
    });
    
    // Use Function constructor for safe evaluation
    const result = new Function(`return ${sanitizedCondition}`)();
    
    if (!result) {
      throw new Error(`Assertion failed: ${condition}`);
    }
  }

  getVariable(name: string): unknown {
    return this.context.variables[name];
  }

  getReporter(): TestReporter {
    return this.context.reporter;
  }
}

export function parseScenarioFile(content: string): TestScenarioFile {
  // Simple YAML-like parser for test scenarios
  const lines = content.split('\n');
  const result: Partial<TestScenarioFile> = {
    scenarios: [],
  };
  
  let currentScenario: Partial<TestScenario> | null = null;
  let currentStep: Partial<TestStep> | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('name:')) {
      result.name = trimmed.replace('name:', '').trim();
    } else if (trimmed.startsWith('description:')) {
      result.description = trimmed.replace('description:', '').trim();
    } else if (trimmed.startsWith('priority:')) {
      result.priority = trimmed.replace('priority:', '').trim();
    } else if (trimmed.startsWith('tags:')) {
      result.tags = trimmed.replace('tags:', '').trim().replace(/[\[\]]/g, '').split(',').map(t => t.trim());
    } else if (trimmed.startsWith('timeout:')) {
      result.timeout = parseInt(trimmed.replace('timeout:', '').trim());
    } else if (trimmed.startsWith('- id:')) {
      if (currentScenario && result.scenarios) {
        result.scenarios.push(currentScenario as TestScenario);
      }
      currentScenario = { id: trimmed.replace('- id:', '').trim(), steps: [] };
    } else if (trimmed.startsWith('name:') && currentScenario) {
      currentScenario.name = trimmed.replace('name:', '').trim();
    } else if (currentScenario && trimmed.startsWith('description:')) {
      currentScenario.description = trimmed.replace('description:', '').trim();
    } else if (trimmed.startsWith('- action:') && currentScenario && currentScenario.steps) {
      currentStep = { action: trimmed.replace('- action:', '').trim() };
      currentScenario.steps.push(currentStep as TestStep);
    } else if (currentStep) {
      if (trimmed.startsWith('selector:')) {
        currentStep.selector = trimmed.replace('selector:', '').trim().replace(/"/g, '');
      } else if (trimmed.startsWith('params:')) {
        try {
          currentStep.params = JSON.parse(trimmed.replace('params:', '').trim());
        } catch {
          // Handle simple params like { name: "file.png" }
          const paramsStr = trimmed.replace('params:', '').trim();
          const simpleMatch = paramsStr.match(/\{\s*(\w+):\s*"([^"]+)"\s*\}/);
          if (simpleMatch) {
            currentStep.params = { [simpleMatch[1]]: simpleMatch[2] };
          }
        }
      } else if (trimmed.startsWith('saveAs:')) {
        currentStep.saveAs = trimmed.replace('saveAs:', '').trim().replace(/"/g, '');
      }
    }
  }
  
  // Add last scenario
  if (currentScenario && result.scenarios) {
    result.scenarios.push(currentScenario as TestScenario);
  }
  
  return result as TestScenarioFile;
}