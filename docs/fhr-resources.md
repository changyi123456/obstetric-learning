# M2 胎心率資源查核

查核日期：2026-10-15。版本 fhr-1。先讀 v0.6 規格第十、十一、十五、十八至二十一章及兩份原始胎心率參考資料，再查網路與 GitHub。

| 資源 | 查得內容與授權 | 本次決定 |
| --- | --- | --- |
| [CTGViewer](https://github.com/jirispilka/CTGViewer) | Python 桌面研究工具；FHR/UC 同軸、註記、輸出 PDF；GPL-3.0 | 研究雙軌與註記形式，未複製程式或圖片；不是手機自主教學流程。 |
| [Oxford CTG-EFM-NST Plotting Package](https://github.com/oxdhl/CTG-EFM-NST-Plotting-Package) | Python 繪圖套件，有雙軌、秒／分網格、輸出；README 僅稱開源，本次頁面未見明確授權條款 | 未重用程式或配色分類；自行實作互動 SVG。 |
| [ctgen](https://github.com/gergelyacs/ctgen) | CTG 資料產生器；本次檢視未確認可重用授權 | 未重用程式或產出；自行定義可追溯事件參數。 |
| [PhysioNet CTU-CHB](https://physionet.org/content/ctu-uhb-ctgdb/1.0.0/) | 552 段臨床 CTG；資料庫 ODC-By 1.0 | 本階段要九段明確可核對的基礎題，未下載或使用病人資料。 |
| [NICE NG229 recommendations](https://www.nice.org.uk/guidance/ng229/chapter/Recommendations) | 依減速與宮縮的時間、持續、恢復等觀察；晚期定義最低點在宮縮峰後 >20 秒；基線需看穩定 10 分鐘 | 以自己的文字製作教學關係；不複製指引圖。此 7 分鐘片段不作基線評估。 |
| [FIGO 2015 CTG consensus](https://doi.org/10.1016/j.ijgo.2015.06.020) | 突然下降至最低點 <30 秒、時序與波形可變；晚期開始、最低點及恢復均相對延後 | 製作早晚漸降與變異突然下降的參數，包含中間谷底對齊宮縮的變異題。 |

## 自製素材選擇

依規格第十五章，M2 以可縮放 2D 圖形為主，不需要新增 3D；本階段不增加 Blender 模型。現有 Blender 骨盆、胎兒與分娩動畫保持原版本。SVG 是可互動的資料圖，不是示意曲線圖片。

所有九段曲線來自 `src/fhr.ts` 的事件資料。同一資料產生顯示、正解區間、回饋與測試；沒有依噪聲猜類型。0.5 秒繪圖取樣，事件及標記以秒保存。TOCO 0–100 為相對讀值；沒有 mmHg。

## 原始教材差異處理

原始 PDF 的正常基線 120–160 bpm，與 NICE 110–160 bpm 有差異；本次不把範圍當成測驗。使用 135/140/145 bpm「設定基線」，不從短片段估計生理基線。原始教材中單憑深度／持續推論立即生產的敘述不納入本次型態辨識題。正式醫療內容、題庫及 ±5 秒標記容差仍由使用者確認。
