import { usePluginWidgets, type WidgetSlot } from '../hooks/usePluginWidgets';
import { renderWidgetWithIsolation } from '../rendering/registry';

interface PluginWidgetSlotProps {
  slot: WidgetSlot;
  className?: string;
}

/**
 * 固定插件槽位宿主：渲染声明式 widget 元数据，无 widget 时渲染 null。
 * 视觉由应用内静态 renderer 计算（renderWidgetWithIsolation），不加载插件代码。
 */
export const PluginWidgetSlot: React.FC<PluginWidgetSlotProps> = ({ slot, className }) => {
  const { widgets, widgetData } = usePluginWidgets(slot);

  if (widgets.length === 0) return null;

  return (
    <div className={className}>
      {widgets.map((w) => {
        const data = widgetData[w.type];
        if (!data) return null;

        const rendered = renderWidgetWithIsolation(w.renderer_id, {
          data,
          config: w.config,
          widget: w,
        });
        const text = rendered?.text ?? data.text ?? w.display_name;
        const color = rendered?.color ?? data.color;
        const tooltip = rendered?.tooltip ?? data.tooltip ?? w.display_name;

        return (
          <div
            key={w.type}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-theme-input/50 border border-subtle cursor-help transition-colors"
            title={tooltip}
            style={color ? { color } : undefined}
          >
            <span className="text-[11px] font-medium truncate">{text}</span>
          </div>
        );
      })}
    </div>
  );
};
