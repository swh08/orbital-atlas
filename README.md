<div align="center">
  <img src="./public/brand/orbital-atlas-logo.png" width="96" alt="Orbital Atlas logo" />

  # 轨道图谱

  **一座可漫游的太阳系。** 基于 Three.js 构建，以科学轨道数据、电影化镜头与本地高精资源呈现从太阳到海王星的实时探索体验。

  `Three.js` · `TypeScript` · `Vite` · `J2000 / Kepler`
</div>

<br />

![轨道图谱全景](./artifacts/ui-audit/01-overview-desktop.png)

<div align="center"><sub>全景模式 · 行星轨道、小行星带、银河与分光谱星场</sub></div>

## 这不是一张静态星图

轨道图谱将 J2000 近似轨道参数与 Kepler 方程带入浏览器。每一颗天体拥有独立的公转、自转与轴倾；为了让整个太阳系在同一画面中可读，天体半径和轨道距离采用各自的可观察压缩比例。

| 探索 | 真实感 | 可用性 |
| --- | --- | --- |
| 点击天体、目录选择、自动导览、电影镜头与自由飞行 | 本地观测纹理、程序化太阳、大气昼夜侧、土星环与 ACES 色调映射 | 响应式 HUD、键盘操作、WebGL 状态提示与降低动态效果支持 |

## 近距离观察地球

![地球详情](./artifacts/ui-audit/03-earth-detail-desktop.png)

<div align="center"><sub>天体档案 · 独立云层、夜光与高程细节，信息面板与镜头同步聚焦</sub></div>

## 启动

```bash
pnpm install
pnpm dev
```

生产构建与预览：

```bash
pnpm build
pnpm preview
```

## 操作方式

| 操作 | 效果 |
| --- | --- |
| 拖动 / 滚轮 / 双指缩放 | 环绕并调整观察距离 |
| 点击天体或打开“天体”目录 | 聚焦并打开天体档案 |
| 空格 | 暂停或恢复时间 |
| `[` / `]` | 调低 / 调高时间倍率 |
| `T` | 开始或停止自动导览 |
| `Esc` | 返回全景 |
| 自由飞行：`WASD`、`Q/E`、`Shift` | 水平移动、升降、加速 |

## 渲染与交互

- ACES Filmic 色调映射、线性工作流与阈值 Bloom
- 程序化太阳光球、日冕与磁环；GPU 实例化小行星与星点
- 统一的太阳定向照明、材质响应、大气衰减与近景取景
- 轨道线可开关；月球轨迹与位置共用同一 Kepler 求解
- 桌面与移动端共用最终纹理、几何、抗锯齿与后期管线
- WebGL 上下文丢失提示、页面隐藏自动暂停，以及 `prefers-reduced-motion` / `prefers-reduced-transparency` 降级

## 科学与资源边界

轨道偏心率、倾角、周期、自转和轴倾来自 JPL/NASA 近似参数。项目明确区分观测颜色、模型纹理与渲染派生材质：NASA、USGS 与 NOAA 档案并不为所有天体提供统一的 PBR 套图，气态与冰巨行星也不会被描述为拥有实测固体高度图。

金星的 Magellan 资源是雷达衍生表面基线，近景由不透明的程序化浓云层遮盖；土星颜色图来自 NOAA Science On a Sphere，土星环纹理单独提取自 NASA VTAD 的 Saturn GLB。天王星与海王星保留 NASA VTAD GLB 提供的 1024 × 512 纹理，并不宣称为更高分辨率的观测图。

最终天体资源已离线处理并随项目本地打包：金星、地球与火星主图为 4096 × 2048；地球云层、夜光和高程及火星高程同为 4096 × 2048；木星为 3601 × 1801；土星为 2880 × 1440，环系径向纹理为 4096 × 16。完整资源、署名与许可见 [public/SOURCES.json](./public/SOURCES.json)。
