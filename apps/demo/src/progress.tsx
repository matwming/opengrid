import { createRoot } from 'react-dom/client';
import './demo.css';

const measured = '2026年10月31日 13:57（澳大利亚墨尔本时间）';

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
          下面的数字来自 <code>bench/results.json</code>，测量时间是 {measured}。三次重复，100 万行、50 个数字列，Chromium，对照 <code>ag-grid-enterprise</code> 36.2.0。写出的是按排序耗时取中间的那一次。
        </p>

        <section>
          <h2>基准</h2>
          <div className="stats">
            <p><strong>67 ms</strong><span>排序，中间一次</span></p>
            <p><strong>59 ms</strong><span>过滤，中间一次</span></p>
            <p><strong>60 fps</strong><span>滚动，三次都是 60</span></p>
            <p><strong>19 ms</strong><span>首次绘制，中间一次</span></p>
          </div>
          <table>
            <caption>中间一次。排序和过滤是从 API 调用到 modelUpdated 的墙上时间。</caption>
            <thead>
              <tr>
                <th>指标</th>
                <th>Opengrid</th>
                <th>AG Grid Enterprise 36.2.0</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>首次绘制</td>
                <td>19 ms</td>
                <td>817 ms</td>
              </tr>
              <tr>
                <td>滚动</td>
                <td>60 fps，p95 帧 16.7 ms</td>
                <td>41 fps，p95 帧 33.3 ms</td>
              </tr>
              <tr>
                <td>排序 c0</td>
                <td>67.3 ms，其中主线程 59 ms</td>
                <td>1489 ms</td>
              </tr>
              <tr>
                <td>数字过滤 greaterThan 50000</td>
                <td>59.3 ms，499,990 行</td>
                <td>905 ms，行数和抽样值相同</td>
              </tr>
              <tr>
                <td>压缩后的入口</td>
                <td>39,656 字节</td>
                <td>721,207 字节</td>
              </tr>
            </tbody>
          </table>
          <p className="note">三次里首次绘制是 19、23、21 ms，企业版是 705 到 970 ms。列数组改到 firstDataRendered 之后再抄。中间这一次的 worker 等待是 1135 ms，拷贝算在里面，不算在首次绘制里。排序是 61 到 76 ms，企业版是 1456 到 1510 ms。过滤是 59 到 71 ms，企业版是 864 到 905 ms。滚动三次都是 60 fps，企业版是 41 到 44 fps。排序在主线程算完。堆内存增量没有测到变化，这里不写内存胜负。</p>
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
                <td>能加载、排序、过滤、<code>applyTransaction</code>。4 万行按数量降序后，同一次调用读到的第一行就是 39999。</td>
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
                <td><code>rowDragManaged</code> 在 Chromium 里把 a 拖到第三行，顺序变成 b、c、a、d，<code>onRowDragEnd</code> 的 <code>overIndex</code> 是 2，和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>Vue</td>
                <td><code>AgGridVue</code> 用属性接收 gridOptions，发出 <code>grid-ready</code>，并暴露 <code>api</code>。单元格组件用 <code>setup</code> 渲染，名字格会画出 <code>vue-cell</code> 里的 Ada。</td>
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
                <td><code>allowFormula</code> 把 <code>=[qty]*2</code> 显示成 8，把 <code>=1+2</code> 显示成 3。<code>=SUM([qty],[bonus])</code> 是 5，<code>=SUM([qty])</code> 是 3。<code>=SUM(A1:B2)</code> 是 10，<code>=B1</code> 是 1，<code>=SUM(A1:A2)</code> 是 7，和 <code>ag-grid-enterprise</code> 36.2.0 一样。行号列不占字母。<code>formulaDataSource</code> 提供 <code>=1+2</code> 时格子显示 3，行数据仍是 9，<code>refreshFormulas</code> 之后和企业版 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>查找</td>
                <td><code>findSearchValue: 'ada'</code> 找到 2 处，和 <code>ag-grid-enterprise</code> 36.2.0 的次数一样。<code>findNext</code> 先聚焦名字格，再聚焦城市格。匹配的文字包在 <code>mark.og-find</code> 里，文字是 Ada。两次 <code>findNext</code> 之后，当前匹配在城市格，带 <code>og-find-active</code>，和企业版的当前匹配列一样。</td>
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
                <td>按钮 <code>Export</code> 会执行 <code>action</code>。快速过滤占位是 <code>Filter...</code>，查找占位是 <code>Find...</code>，输入停 300 毫秒后生效。查找次数和下一次匹配的显示，以及分组占位 <code>Drag here to set row groups</code>，都和 <code>ag-grid-enterprise</code> 36.2.0 一样。菜单项列出 Copy 和 Export。透视模式下列出 Year。Copy 旁边的快捷键是 <code>Ctrl+C</code>，和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>对齐网格</td>
                <td><code>alignedGrids</code> 让两张表的横向滚动停在同一位置。列宽、列顺序和隐藏也跟着走，和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>备注</td>
                <td><code>notesDataSource</code> 配合 <code>setNote</code> 和 <code>getNote</code> 在名字格记下 hello，和 <code>ag-grid-enterprise</code> 36.2.0 一样。无障碍单元格带 <code>data-note</code>。<code>noteTrigger: 'click'</code> 打开弹层，正文是 hello，作者行是 <code>Ada · 2020-01-02</code>。把正文改成 there 再离开，两边都写回 there，作者仍是 Ada。</td>
              </tr>
              <tr>
                <td>树</td>
                <td><code>treeData</code> 和 <code>getDataPath</code> 按路径嵌套。CEO 下面有 Sales 和 Support，收起 Sales 后 EU 不再显示。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>主从明细</td>
                <td><code>masterDetail</code> 展开主行后多出一行。只有 <code>isRowMaster</code> 允许的行会展开。明细行 id 是 <code>detail_0</code>，<code>detail</code> 为 true，和 <code>ag-grid-enterprise</code> 36.2.0 一样。<code>detailCellRenderer</code> 可以返回字符串。</td>
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
                <td><code>copySelectedRangeToClipboard</code> 把范围做成制表符文本，行之间是 <code>\r\n</code>，和 <code>ag-grid-enterprise</code> 36.2.0 一样。<code>processCellForClipboard</code> 可以改每个格子。粘贴会写回范围，数字列仍是数字。</td>
              </tr>
              <tr>
                <td>填充柄</td>
                <td><code>cellSelection.handle.mode</code> 设为 <code>fill</code> 后，在 Chromium 里拖填充柄，把 4 抄到下面两行，范围终点是第 2 行，和 <code>ag-grid-enterprise</code> 36.2.0 一样。<code>fillOperation</code> 可以改写入的值。</td>
              </tr>
              <tr>
                <td>Excel 导出</td>
                <td><code>getDataAsExcel</code> 返回以 PK 开头的 <code>.xlsx</code>，文件里有 Ada，和 <code>ag-grid-enterprise</code> 36.2.0 一样。还没有样式、多表和导出弹窗。</td>
              </tr>
              <tr>
                <td>服务端行模型</td>
                <td><code>serverSideDatasource.getRows</code> 先要第 0 块，和 <code>ag-grid-enterprise</code> 36.2.0 一样。<code>success</code> 填进 Ada。还没有服务端分组和透视。</td>
              </tr>
              <tr>
                <td>状态栏</td>
                <td><code>agTotalRowCountComponent</code> 显示 <code>Total Rows : 2</code>，过滤后仍是这个数，和 <code>ag-grid-enterprise</code> 36.2.0 一样。没过滤时 <code>agTotalAndFilteredRowCountComponent</code> 是 <code>Rows : 2</code>。滤成 1 行时这边写成 <code>Rows : 1 of 2</code>。</td>
              </tr>
              <tr>
                <td>集成图表</td>
                <td><code>createRangeChart</code> 覆盖企业版能创建的图种。工具条有 Unlink from Grid、Download Chart 和 Menu。Edit Chart 打开 Chart、Set Up、Customize。Chart 列出五个主题。Set Up 有 Categories、Series 和 Switch Category / Series。Customize 有 Titles、Legend、Horizontal Axis、Vertical Axis、Series 和 Font。Chromium 里企业版的格式页同样有 Horizontal Axis、Series 和 Font，Set Up 同样有 Categories 和 Switch Category / Series。点第二个主题后两边都是 <code>ag-material</code>。</td>
              </tr>
              <tr>
                <td>迷你图</td>
                <td><code>cellRenderer: 'agSparklineCellRenderer'</code> 默认画折线。<code>sparklineOptions.type: 'area'</code> 画面积，<code>'bar'</code> 画柱。<code>[1, 3, 2]</code> 的面积图在 Chromium 里和企业版一样出现 <code>ag-sparkline-wrapper</code>。</td>
              </tr>
              <tr>
                <td>侧边栏</td>
                <td><code>sideBar: true</code> 的页签是 Columns 和 Filters，和 <code>ag-grid-enterprise</code> 36.2.0 一样。列面板可以藏起一列。过滤面板打开那一列的过滤。自定义工具面板还没有。</td>
              </tr>
              <tr>
                <td>多重过滤</td>
                <td><code>agMultiColumnFilter</code> 打开两个文本框。Apply 之后，每一条都匹配才留下。没有和企业版并排对照。</td>
              </tr>
              <tr>
                <td>高级过滤</td>
                <td><code>setAdvancedFilterModel</code> 用 AND 或 OR 组合条件。搭建界面有 <code>Select a column</code>、<code>Select an option</code>、<code>Enter a value...</code> 和 Apply。名字包含 y 时留下 Amy。</td>
              </tr>
              <tr>
                <td>视口行模型</td>
                <td><code>viewportDatasource.init</code> 收到 <code>setRowCount</code> 和 <code>setRowData</code>。240 像素高、行高 36、共 4 行时，<code>setViewportRange</code> 是 0 到 3，和 <code>ag-grid-enterprise</code> 36.2.0 一样。</td>
              </tr>
              <tr>
                <td>React</td>
                <td><code>AgGridReact</code> 接收 gridOptions，<code>ref.api</code> 可用。</td>
              </tr>
              <tr>
                <td>Angular</td>
                <td><code>AgGridAngular</code> 用输入绑定 <code>rowData</code> 和 <code>columnDefs</code>，发出 <code>gridReady</code>。实现 <code>agInit</code> 和 <code>getGui</code> 的单元格类会画出 Ada。</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>还没做</h2>
          <ul>
            <li>格式面板里的网格线、刻度、标签旋转，以及 Set Up 里的聚合、方向和组类型。主题页列出五个主题名，缩略图还没画。</li>
          </ul>
        </section>

        <section>
          <h2>已知问题</h2>
          <ul>
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
