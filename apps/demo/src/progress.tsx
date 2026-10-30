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
                <td>React</td>
                <td><code>AgGridReact</code> 接收 gridOptions，<code>ref.api</code> 可用。</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>还没做</h2>
          <ul>
            <li>行拖拽、Vue 封装、Angular 封装。</li>
            <li>分组、聚合、透视、树、主从明细。</li>
            <li>集合过滤、多重过滤、高级过滤。</li>
            <li>范围选择、剪贴板、填充柄、Excel 导出。</li>
            <li>服务端行模型、视口行模型、集成图表、迷你图、状态栏、侧边栏、工具面板。</li>
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
            <li>自定义比较器留在主线程。分组还没做，所以这一项没有计时。</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('missing root');
createRoot(root).render(<App />);
