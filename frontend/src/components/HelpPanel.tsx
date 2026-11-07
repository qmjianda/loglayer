import React from 'react';

const layerGroups = [
  {
    title: '处理图层',
    items: [
      ['过滤图层', '按文本或正则表达式过滤，可切换排除模式。'],
      ['等级图层', '按 INFO、WARN、ERROR、DEBUG、FATAL 等级过滤。'],
      ['范围图层', '只保留指定的起止行号。'],
      ['时间范围 / 时间范围过滤', '按自定义或自动识别的时间戳筛选日志。'],
      ['相对时间过滤', '保留最近 N 分钟、小时或天的日志。'],
      ['替换图层', '使用正则表达式替换视图中的文本，原文件不变。'],
    ],
  },
  {
    title: '显示图层',
    items: [
      ['高亮图层', '为匹配文本设置颜色和不透明度。'],
      ['行背景图层', '为匹配行设置背景色。'],
      ['书签标记', '书签由系统管理，可在行号区域添加并在右侧面板查看。'],
    ],
  },
];

const shortcuts = [
  ['Ctrl / Cmd + F', '打开或聚焦当前面板的查找框'],
  ['F3 / Shift + F3', '下一个 / 上一个搜索匹配'],
  ['Enter / Shift + Enter', '查找框中下一个 / 上一个匹配'],
  ['Ctrl / Cmd + G', '打开跳转到行'],
  ['F2 / Shift + F2', '下一个 / 上一个书签'],
  ['Ctrl / Cmd + H', '打开搜索历史'],
  ['Ctrl / Cmd + B', '切换左侧边栏'],
  ['Ctrl / Cmd + O', '打开文件/文件夹选择器'],
  ['Ctrl / Cmd + Shift + O', '打开文件夹选择器'],
  ['Ctrl / Cmd + Shift + P', '打开命令面板'],
  ['Ctrl / Cmd + Shift + T', '开始或停止文件监视'],
  ['Ctrl / Cmd + Shift + H', '高亮选中的文本'],
  ['Ctrl / Cmd + Shift + D', '打开诊断浮层'],
  ['Ctrl / Cmd + ,', '打开设置'],
  ['Ctrl / Cmd + Z / Y', '撤销 / 重做图层操作'],
  ['Alt + C / W / R', '切换大小写 / 全字 / 正则搜索选项'],
];

const GuideCard: React.FC<{
  index: string;
  title: string;
  accent: string;
  children: React.ReactNode;
}> = ({ index, title, accent, children }) => (
  <section className="bg-dark-1 p-5 rounded-lg border border-white/5">
    <h3 className={`text-sm font-bold ${accent} mb-3 flex items-center`}>
      <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center mr-2 text-xs">
        {index}
      </span>
      {title}
    </h3>
    <div className="text-xs text-gray-400 space-y-2 leading-relaxed">{children}</div>
  </section>
);

export const HelpPanel: React.FC = () => {
  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar bg-dark-2 text-gray-300 select-text">
      <div className="max-w-4xl mx-auto w-full">
        <header className="mb-8 border-b border-white/10 pb-6">
          <h2 className="text-2xl font-black text-blue-400 mb-2 flex items-center tracking-tight">
            <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeWidth="2.5"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            LogLayer 使用手册
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            LogLayer v0.1.0 是运行在本机的浏览器日志分析工具。它通过索引、虚拟化渲染和
            ripgrep，帮助你浏览、搜索和标记大型日志文件；原始文件始终保持不变。
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <GuideCard index="1" title="打开文件与工作区" accent="text-blue-400">
            <p>
              在<strong className="text-gray-200">工作区</strong>
              视图中打开文件或文件夹，也可以将文件拖入窗口。
            </p>
            <p>
              打开文件夹会建立工作区并列出其中的日志文件；文件不会全部自动加载，点击需要分析的文件即可打开。
            </p>
            <p>首次打开文件会建立行偏移索引，大文件可能需要等待；之后可复用工作区缓存。</p>
          </GuideCard>

          <GuideCard index="2" title="搜索与定位" accent="text-cyan-400">
            <p>
              <strong className="text-gray-200">Ctrl/Cmd + F</strong> 打开当前编辑面板的查找框，左侧
              <strong className="text-gray-200">搜索</strong>视图提供当前文件的搜索结果列表。
            </p>
            <p>查找框支持“高亮”和“过滤”模式，并可切换正则、区分大小写、全字匹配。</p>
            <p>搜索范围是当前激活文件，不是整个工作区；匹配结果可直接跳转到对应行。</p>
          </GuideCard>

          <GuideCard index="3" title="图层分析" accent="text-purple-400">
            <p>
              在右侧操作台点击<strong className="text-gray-200">添加图层</strong>
              ，配置后可启用、禁用、拖拽排序，并使用撤销/重做。
            </p>
            <p>图层按顺序组合：处理图层改变可见内容，显示图层只改变视觉呈现。</p>
            <p>可将当前图层组合保存为预设，在其他文件上复用。</p>
          </GuideCard>

          <GuideCard index="4" title="书签与文件监视" accent="text-amber-400">
            <p>点击日志行号区域添加或移除书签；右侧书签面板可添加备注、跳转和清空书签。</p>
            <p>使用 F2 / Shift + F2 在书签之间移动，命令面板中的“导出书签”可保存 JSON。</p>
            <p>
              文件监视每 2
              秒检查一次文件变化，检测到变化后显示提示；当前版本不会自动重新索引文件内容。
            </p>
          </GuideCard>
        </div>

        <div className="space-y-8 pb-16">
          <section className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-lg">
            <h3 className="text-sm font-black text-blue-400 mb-4 uppercase tracking-widest">
              内置图层
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-xs">
              {layerGroups.map((group) => (
                <div key={group.title}>
                  <h4 className="text-gray-200 font-semibold mb-2">{group.title}</h4>
                  <ul className="space-y-2 text-gray-400">
                    {group.items.map(([name, description]) => (
                      <li key={name}>
                        <strong className="text-gray-300">{name}：</strong>
                        {description}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-5 border-t border-white/10 pt-4">
              图层只在视图和处理管线中生效，不会写回原始日志。受信任插件还可以向添加图层菜单和状态栏注册扩展能力。
            </p>
          </section>

          <section className="bg-dark-1 p-6 rounded-lg border border-white/5">
            <h3 className="text-sm font-black text-green-400 mb-4 uppercase tracking-widest">
              工作区数据与设置
            </h3>
            <div className="text-xs text-gray-400 space-y-3 leading-relaxed">
              <p>
                选择工作区后，文件历史、打开状态、图层、书签和编辑器布局会保存到工作区目录的
                <code className="text-green-400 mx-1">.loglayer/workspace.db</code>。
              </p>
              <p>
                行偏移索引缓存位于同目录的{' '}
                <code className="text-green-400 mx-1">.loglayer/cache.db</code>，可在设置的“高级 →
                缓存”中调整上限或清空。清空缓存不会删除工作区配置。
              </p>
              <p>
                设置面板可调整主题、字体、行高、行号、虚拟行号、标尺、换行、空白字符、搜索默认选项、搜索历史上限、缓存大小和调试模式。
              </p>
            </div>
          </section>

          <section className="bg-dark-1 p-6 rounded-lg border border-white/5">
            <h3 className="text-sm font-black text-gray-300 mb-4 uppercase tracking-widest">
              常用快捷键
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {shortcuts.map(([keys, description]) => (
                <div
                  key={keys}
                  className="bg-black/30 p-2.5 rounded border border-white/5 flex justify-between items-center gap-3"
                >
                  <span className="text-xs text-gray-400">{description}</span>
                  <kbd className="shrink-0 text-[10px] font-mono bg-white/10 px-2 py-1 rounded text-gray-200">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-4">
              macOS 使用 Command；查找框内 Enter / Shift + Enter 可移动匹配项，Esc
              会先收起查找框，再清空搜索。
            </p>
          </section>

          <section className="bg-dark-1 p-6 rounded-lg border border-white/5">
            <h3 className="text-sm font-black text-orange-400 mb-4 uppercase tracking-widest">
              服务与 API
            </h3>
            <div className="text-xs text-gray-400 space-y-2 leading-relaxed">
              <p>
                LogLayer 由本地 FastAPI 服务和浏览器前端组成。默认地址为
                <code className="text-orange-300 mx-1">http://127.0.0.1:12345</code>，开发前端地址为
                <code className="text-orange-300 mx-1">http://127.0.0.1:3000</code>。
              </p>
              <p>
                FastAPI 交互文档位于服务地址的 <code className="text-orange-300 mx-1">/docs</code>
                ，备用文档位于
                <code className="text-orange-300 mx-1">/redoc</code>；实时信号使用
                <code className="text-orange-300 mx-1">/ws</code>。
              </p>
              <p className="text-orange-200/80">
                默认服务只监听本机。使用 <code className="mx-1">--host 0.0.0.0</code>{' '}
                前请确认网络可信；当前版本没有用户认证。
              </p>
            </div>
          </section>

          <section className="bg-dark-1 p-6 rounded-lg border border-white/5">
            <h3 className="text-sm font-black text-red-300 mb-4 uppercase tracking-widest">
              性能与已知限制
            </h3>
            <ul className="text-xs text-gray-400 space-y-2 leading-relaxed list-disc pl-5">
              <li>日志内容采用 UTF-8 解码；非 UTF-8 文件可能出现替换字符或搜索结果不完整。</li>
              <li>
                视图使用虚拟化渲染，但完整行偏移索引仍会占用内存；文件越大，建议预留更多内存。
              </li>
              <li>
                搜索、过滤和日志级别统计依赖 ripgrep。发布包自带对应平台二进制，源码运行需保留 bin
                目录或让 rg 在 PATH 中可用。
              </li>
              <li>打开文件夹不会自动载入所有文件；按需打开文件可以减少启动时的索引和内存压力。</li>
            </ul>
          </section>
        </div>

        <footer className="text-center pb-8 opacity-50">
          <div className="text-[10px] font-mono tracking-widest uppercase">
            LogLayer v0.1.0 · 首个公开版本 · 本地服务模式
          </div>
        </footer>
      </div>
    </div>
  );
};
