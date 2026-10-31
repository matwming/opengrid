import { createRoot } from 'react-dom/client';
import './demo.css';

const measured = '2026年10月30日 21:28（澳大利亚墨尔本时间）';

function App() {
  return (
    <div className="progress">
      <nav className="site-nav">
        <a href="/">演示</a>
        <a href="/bench">基准</a>
        <a href="/progress" aria-current="page">进度</a>
      </nav>
      <header className="top">
        <div>
          <p className="kicker">Opengrid</p>
          <h1>进度</h1>
        </div>
      </header>
      <main className="progress-main">
        <p>
          这个站点是唯一的主页。演示在 <a href="/">首页</a>，基准程序在 <a href="/bench">/bench</a>。
          下面的数字来自 <code>bench/results.json</code>，测量时间是 {measured}。三次重复，100 万行、50 个数字列，Chromium，对照 <code>ag-grid-community</code> 36.2.0。写出的是按排序耗时取中间的那一次。
        </p>

        <section>
          <h2>基准</h2>
          <div className="stats">
            <p><strong>81 ms</strong><span>排序，中间一次</span></p>
            <p><strong>62 ms</strong><span>过滤，中间一次</span></p>
            <p><strong>60 fps</strong><span>滚动，三次都是 60</span></p>
            <p><strong>1.11 s</strong><span>首次绘制，中间一次</span></p>
          </div>
          <table>
            <caption>中间一次。排序和过滤是从 API 调用到 modelUpdated 的墙上时间。</caption>
            <thead>
              <tr>
                <th>指标</th>
                <th>Opengrid</th>
                <th>AG Grid Community 36.2.0</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>首次绘制</td>
                <td>1106 ms</td>
                <td>810 ms</td>
              </tr>
              <tr>
                <td>滚动</td>
                <td>60 fps，p95 帧 16.7 ms</td>
                <td>39 fps，p95 帧 33.3 ms</td>
              </tr>
              <tr>
                <td>排序 c0</td>
                <td>80.9 ms，其中 worker 61 ms</td>
                <td>1808 ms</td>
              </tr>
              <tr>
                <td>数字过滤 greaterThan 50000</td>
                <td>62.2 ms，499,990 行</td>
                <td>979 ms，行数和抽样值相同</td>
              </tr>
              <tr>
                <td>压缩后的入口</td>
                <td>19,414 字节</td>
                <td>186,044 字节</td>
              </tr>
            </tbody>
          </table>
          <p className="note">三次里首次绘制是 1106、1131、1323 ms，AG Grid 是 800 到 817 ms。Opengrid 更慢，因为它在 firstDataRendered 之前把每个值抄进列数组。堆内存增量没有测到变化，这里不写内存胜负。</p>
        </section>

        <section>
          <h2>已经核对过的</h2>
          <p>对照是 <code>ag-grid-community</code> 36.2.0 的同一次调用，或者演示本身。2026年10月31日早上，<code>npx vitest run</code> 是 13 项通过，库的 <code>tsc</code> 退出码是 0。浏览器端到端没有为这一轮的新接口重跑。</p>
          <table>
            <thead>
              <tr>
                <th>功能</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>客户端行模型</td>
                <td>能加载、排序、过滤、<code>applyTransaction</code>。超过 32,768 行时，排序和过滤在 <code>modelUpdated</code> 才完成。</td>
              </tr>
              <tr>
                <td>行列虚拟化、固定、缩放、移动、主题</td>
                <td>演示里可用。主题是自己的，类名是 <code>og-</code>。</td>
              </tr>
              <tr>
                <td>文本、数字、日期过滤和编辑</td>
                <td>简单条件、inRange、空值和 AND/OR 与 36.2.0 一致。浮动过滤和自定义编辑器没有做。</td>
              </tr>
              <tr>
                <td>选择、CSV、键盘</td>
                <td>多选、复选框、带引号的 CSV 与 36.2.0 的夹具一致。方向键、Enter、Escape、Space、Ctrl 或 Cmd A 可用。</td>
              </tr>
              <tr>
                <td>快速过滤</td>
                <td>默认搜索与 36.2.0 一致，隐藏列也参与。词与词是并且，忽略大小写。<code>quickFilterParser</code> 没有做。</td>
              </tr>
              <tr>
                <td>分页</td>
                <td>页大小、当前页、总页数和 <code>paginationGoToPage</code> 与 36.2.0 一致。<code>getDisplayedRowCount</code> 仍是过滤后的总行数。</td>
              </tr>
              <tr>
                <td>状态</td>
                <td><code>getState</code> 和 <code>setState</code> 能来回保存排序、过滤、列顺序、列宽、固定、隐藏、页码和选中行。滚动和焦点不在里面。</td>
              </tr>
              <tr>
                <td>无限滚动</td>
                <td><code>cacheBlockSize</code> 为 10 时，首屏请求的块、行数、排序后的重新请求，以及 <code>purgeInfiniteCache</code> 后的缓存键，与 36.2.0 一致。最后一行未知时，行数是已加载终点再加一行。</td>
              </tr>
              <tr>
                <td>行拖拽</td>
                <td><code>rowDragManaged</code> 把抓住的行放到指针下那一行的前面，并触发 <code>onRowDragEnd</code>。happy-dom 没有触发 36.2.0 的拖拽事件，所以落点没有并排对照。</td>
              </tr>
              <tr>
                <td>Vue</td>
                <td><code>AgGridVue</code> 用属性接收 gridOptions，发出 <code>grid-ready</code>，并暴露 <code>api</code>。改 <code>rowData</code> 会调用 <code>setGridOption</code>。框架单元格组件没有做。</td>
              </tr>
              <tr>
                <td>行分组</td>
                <td>客户端 <code>rowGroup</code> 会生成自动分组列。组键按数据里第一次出现的顺序排，和 <code>ag-grid-enterprise</code> 36.2.0 的探针对上了。USA 在 Ireland 前面。<code>groupDefaultExpanded</code> 和 <code>setExpanded</code> 控制展开。<code>setRowGroupColumns</code> 能换分组列。组脚和分组选择还没有。</td>
              </tr>
              <tr>
                <td>聚合</td>
                <td>分组行的 <code>aggData</code> 支持 <code>sum</code>、<code>min</code>、<code>max</code>、<code>count</code> 和 <code>avg</code>。Ireland 的 sales 4 加 9 等于 13，qty 的平均值是 2。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>透视</td>
                <td><code>pivotMode</code> 的列 id 和第一组的 <code>aggData</code> 与 <code>ag-grid-enterprise</code> 36.2.0 对上了。列名是 <code>pivot_year_2020_sales</code> 这种。<code>getAllGridColumns</code> 不再列出原来的分组列、透视列和值列。多列透视和合计列还没有。</td>
              </tr>
              <tr>
                <td>行号</td>
                <td><code>rowNumbers: true</code> 加上 <code>ag-Grid-RowNumbersColumn</code>，位置和 <code>ag-grid-enterprise</code> 36.2.0 一样。前两行显示 1 和 2。</td>
              </tr>
              <tr>
                <td>分组面板</td>
                <td><code>rowGroupPanelShow: 'always'</code> 显示 <code>Drag here to set row groups</code>，和企业版 36.2.0 的文字一样。已经分组的列显示表头名。还不能把列拖进面板。</td>
              </tr>
              <tr>
                <td>撤销</td>
                <td>打开 <code>undoRedoCellEditing</code> 后，<code>undoCellEditing</code> 和 <code>redoCellEditing</code> 把 <code>setDataValue</code> 的修改退回和重做，结果和 <code>ag-grid-enterprise</code> 36.2.0 一样。默认最多记 10 步。</td>
              </tr>
              <tr>
                <td>右键菜单</td>
                <td>右键列出 Cut、Copy、Copy with Headers、Copy with Group Headers、Paste、Export，和企业版 36.2.0 的文字一样。Copy 把单元格文字交给 <code>sendToClipboard</code>。子菜单和快捷键还没有。</td>
              </tr>
              <tr>
                <td>列菜单</td>
                <td>表头菜单列出 Sort Ascending、Sort Descending、Pin Column、Autosize This Column、Autosize All Columns、Choose Columns、Reset Columns，和企业版 36.2.0 一样。Sort Ascending 会把行排成升序。固定和过滤的子菜单还没有。</td>
              </tr>
              <tr>
                <td>单元格合并</td>
                <td><code>colSpan</code> 把无障碍单元格加宽，并去掉被盖住的列。200 像素的列跨 2 列后是 400 像素。<code>enableCellSpan</code> 加上 <code>spanRows</code> 把连续相同的 USA 合成一行，<code>aria-rowspan</code> 是 2，高度是 83 像素，和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>公式</td>
                <td><code>allowFormula</code> 把 <code>=[qty]*2</code> 显示成 8，把 <code>=1+2</code> 显示成 3。<code>=SUM([qty],[bonus])</code> 是 5，<code>=SUM([qty])</code> 是 3。<code>=SUM(A1:B2)</code> 是 10，<code>=B1</code> 是 1，<code>=SUM(A1:A2)</code> 是 7，和 <code>ag-grid-enterprise</code> 36.2.0 一样。行号列不占字母。公式数据源还没有。</td>
              </tr>
              <tr>
                <td>查找</td>
                <td><code>findSearchValue: 'ada'</code> 找到 2 处，和 <code>ag-grid-enterprise</code> 36.2.0 的次数一样。<code>findNext</code> 先聚焦名字格，再聚焦城市格。匹配的无障碍单元格带 <code>og-find</code>。</td>
              </tr>
              <tr>
                <td>PDF 导出</td>
                <td><code>getDataAsPdf</code> 返回以 <code>%PDF</code> 开头的文件，和 <code>ag-grid-enterprise</code> 36.2.0 的文件头一样。页面文字里有单元格的值。页面设置和图片还没有。</td>
              </tr>
              <tr>
                <td>富选择</td>
                <td><code>agRichSelectCellEditor</code> 打开选项列表。企业版会打开 <code>.ag-rich-select</code>。这边列出 Red 和 Green，选 Green 会写入。happy-dom 里企业版列表停在 Loading，所以没有对上画出来的行。</td>
              </tr>
              <tr>
                <td>批量编辑</td>
                <td><code>startBatchEdit</code> 期间行数据仍是 Ada，<code>isBatchEditing</code> 为 true。<code>cancelBatchEdit</code> 仍是 Ada。<code>commitBatchEdit</code> 写成 Zoe。和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>分组过滤</td>
                <td>子列过滤后，没有匹配子行的组会被藏起。年份等于 2021 时只剩 <code>g:USA</code> 和 2021。<code>agGroupColumnFilter</code> 打开后先显示 <code>Select field:</code>，可选 Country 和 Year。选 Year 再包含 2021，行和企业版 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>分组面板拖拽</td>
                <td>把列拖到分组面板上会按该列分组。拖 Country 之后，分组列是 <code>country</code>，面板芯片文字和企业版 36.2.0 的芯片一样。</td>
              </tr>
              <tr>
                <td>工具条</td>
                <td>按钮 <code>Export</code> 会执行 <code>action</code>。快速过滤占位是 <code>Filter...</code>，查找占位是 <code>Find...</code>，输入停 300 毫秒后生效。查找次数和下一次匹配的显示，以及分组占位 <code>Drag here to set row groups</code>，都和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>对齐网格</td>
                <td><code>alignedGrids</code> 让两张表的横向滚动停在同一位置。列宽、列顺序和隐藏也跟着走，和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>备注</td>
                <td><code>notesDataSource</code> 配合 <code>setNote</code> 和 <code>getNote</code> 在名字格记下 hello，和 <code>ag-grid-enterprise</code> 36.2.0 一样。无障碍单元格带 <code>data-note</code>。<code>noteTrigger: 'click'</code> 打开弹层，正文是 hello，作者行是 <code>Ada · 2020-01-02</code>。</td>
              </tr>
              <tr>
                <td>树</td>
                <td><code>treeData</code> 和 <code>getDataPath</code> 按路径嵌套。CEO 下面有 Sales 和 Support，收起 Sales 后 EU 不再显示。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>主从明细</td>
                <td><code>masterDetail</code> 展开主行后插入明细。只有 <code>isRowMaster</code> 允许的行会展开。<code>detailCellRenderer</code> 可以返回字符串。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>集合过滤</td>
                <td><code>filterType: 'set'</code> 和 <code>ag-grid-enterprise</code> 36.2.0 在探针数据上留下同样的行。<code>agSetColumnFilter</code> 打开勾选列表，点 Apply 后只留勾中的值。弹窗里还没有搜索框。</td>
              </tr>
              <tr>
                <td>范围选择</td>
                <td><code>addCellRange</code> 记下起止行和列。<code>getCellRanges</code> 能读回来。<code>clearCellSelection</code> 清空。打开 <code>cellSelection</code> 后，用鼠标从一格拖到另一格，范围会盖住经过的行和列。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>剪贴板</td>
                <td><code>copySelectedRangeToClipboard</code> 把范围做成制表符文本，交给 <code>sendToClipboard</code>。<code>processCellForClipboard</code> 可以改每个格子。粘贴会写回范围，数字列仍是数字。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>填充柄</td>
                <td><code>cellSelection.handle.mode</code> 设为 <code>fill</code> 后，从选中格往下拖，会把该格的值抄到指针经过的行。<code>fillOperation</code> 可以改写入的值。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>Excel 导出</td>
                <td><code>getDataAsExcel</code> 返回 <code>.xlsx</code>。工作表里有表头和单元格文字。还没有样式、多表和导出弹窗。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>服务端行模型</td>
                <td><code>serverSideDatasource.getRows</code> 收到起止行、排序和过滤。<code>success</code> 把 <code>rowData</code> 和 <code>rowCount</code> 填进这一块。还没有服务端分组和透视。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>状态栏</td>
                <td><code>agTotalRowCountComponent</code> 和 <code>agTotalAndFilteredRowCountComponent</code> 显示当前行数。过滤后数字会跟着变。其他状态面板还没有。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>集成图表</td>
                <td><code>createRangeChart</code> 按范围里的数字列画出柱形图。<code>destroyChart</code> 把它去掉。还没有其他图种、图表工具条，以及图表和表格的联动。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>迷你图</td>
                <td><code>cellRenderer: 'agSparklineCellRenderer'</code> 按单元格里的数字数组画柱。数组 <code>[1, 3, 2]</code> 画出三根柱。还没有折线和面积迷你图。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>侧边栏</td>
                <td><code>sideBar: true</code> 打开列工具面板和过滤工具面板。列面板可以藏起一列。过滤面板打开那一列的过滤。自定义工具面板还没有。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>多重过滤</td>
                <td><code>agMultiColumnFilter</code> 打开两个文本框。Apply 之后，每一条都匹配才留下。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>高级过滤</td>
                <td><code>setAdvancedFilterModel</code> 用 AND 或 OR 组合文本条件和数字条件。名字包含 a 且数量大于 2 时，留下 Bea 和 Amy。还没有高级过滤的搭建界面。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>视口行模型</td>
                <td><code>viewportDatasource.init</code> 收到 <code>setRowCount</code> 和 <code>setRowData</code>。<code>setViewportRange</code> 拿到可见行，数据源把这些行填进来。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>React</td>
                <td><code>AgGridReact</code> 接收 gridOptions，<code>ref.api</code> 可用。</td>
              </tr>
              <tr>
                <td>Angular</td>
                <td><code>AgGridAngular</code> 用输入绑定 <code>rowData</code> 和 <code>columnDefs</code>，发出 <code>gridReady</code>，并设置 <code>api</code>。之后的 <code>rowData</code> 变化会调用 <code>setGridOption</code>。框架单元格组件没有做。</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>还没做</h2>
          <ul>
            <li>行合并 <code>spanRows</code>、公式数据源、工具条的菜单和透视项。</li>
          </ul>
        </section>

        <section>
          <h2>已知问题</h2>
          <ul>
            <li>超过 32,768 行时，同一次调用里马上读取，看到的仍是上一份视图。</li>
            <li>100 万行的首次绘制比 AG Grid 慢。</li>
            <li>日期快速过滤只在 <code>YYYY-MM-DD</code> 上核对过。</li>
            <li>分页的首尾行号只在 happy-dom 里核对过。分页条没有跑过浏览器和 axe。</li>
            <li>100 万行上每次按键的快速过滤耗时没有测量。</li>
            <li>自定义比较器留在主线程。</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('missing root');
createRoot(root).render(<App />);
