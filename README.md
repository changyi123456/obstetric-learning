# 產科學習室

胎位辨識與分娩機轉試教版。獨立於既有 `birth-sim-web`，提供胎位探索與自我測驗，以及分娩機轉的連續示範、七段操作及順序練習。包含回饋、重試、裝置內進度保存與摘要下載。胎心率、觸診與監測為後續製作。

## 開發與驗證

```sh
npm ci
npm run dev
npm test
npm run build
```

本機使用 `http://127.0.0.1:5178/`。獨立入口為 `?module=fetal-position` 與 `?module=birth-mechanism`；模組總覽為 `?module=all`。進度只存在當前瀏覽器、當前網站來源的 localStorage，不收集姓名或學號。

## 模型來源與選用理由

依使用者要求先搜尋 GitHub 現有醫學教育模型，再決定可直接改編或以 Blender 製作。

| 候選 | 調查結果 | 決定 |
| --- | --- | --- |
| [MSF3Dprinting/pelvis-model](https://github.com/MSF3Dprinting/pelvis-model) | MIT 授權；實際下載 STL 並製作三視圖。主要用於 MVA 訓練，外觀與骨盆完整度不適合本次視角，使用者亦提出外觀問題。固定來源版本見 provenance。 | 淘汰，未放入執行畫面 |
| [HiMahendraBeniwal/female-atlas](https://github.com/HiMahendraBeniwal/female-atlas) | 提供 Human Reference Atlas 女性解剖模型的來源線索。應用程式與資料授權分開判讀；直接核對原始 DOI。 | 選用原始 HRA 資料中的骨盆 |
| [Alaa-Essam5/Anatomy_3D_puzzel](https://github.com/Alaa-Essam5/Anatomy_3D_puzzel) | 程式碼有 MIT，但所檢視版本未提供本次可用的完整骨盆資產。 | 不採用 |
| [Junaid2299/FetusViewer](https://github.com/Junaid2299/FetusViewer) | 有早期胎兒 GLB，未查得清楚的模型再利用授權，亦不符合本次頭位教學姿態。 | 不採用 |
| [HarshaShivaKumar7/3D-Fetus](https://github.com/HarshaShivaKumar7/3D-Fetus) 與 [ZelimDamian/ChildBirth](https://github.com/ZelimDamian/ChildBirth) | 未查得可支持本次模型改編與公開發布的明確授權。 | 不採用 |
| [FNNDSC/pl-surfaces-fetus](https://github.com/FNNDSC/pl-surfaces-fetus) | 胎兒腦部表面處理工具，並非所需全身胎兒模型。 | 不採用 |

骨盆採 [Human Reference Atlas United Female v1.5](https://doi.org/10.48539/HBM352.BTSQ.586)，Kristen Browne、Heidi Schlehlein，2023，CC BY 4.0。資料取自 NLM Visible Human Female。擷取左右髂骨、坐骨與恥骨，加上薦骨、尾骨，共八個外層骨組件；只做等比例縮放、定位、表面法線和材質處理。授權依 DOI 的 DataCite 原始中繼資料確認，非僅沿用第三方專案聲明。詳細來源、SHA-256 與組件名保存在 `docs/pelvis-provenance.json`；授權保存在 `licenses/HRA-CC-BY-4.0.txt`。

胎兒以 Blender 4.5.3 LTS 自製為可編輯教學示意。臉部依回饋改成連續曲面，調整頭位下的五官位置、鼻翼、下頜與閉眼線條。用途為枕位方向辨識，未建立生理尺寸、組織形變或產道碰撞模型。

## 編輯與重建模型

`assets-source/female-pelvis.blend` 為擷取後骨盆；`assets-source/fetal-position-assembly.blend` 保存骨盆、胎兒、五官和檢視相機。GLB 位於 `public/models/`，可由 Blender 開啟來源後另存匯出。原始全身 GLB 約 201 MB，不隨網站載入。

完整重建依序執行：

```sh
blender --background --python scripts/extract_pelvis.py -- /absolute/path/3d-vh-f-united.glb /absolute/path/hra-pelvis-extracted.blend
blender --background --python scripts/build_models.py -- /absolute/path/hra-pelvis-extracted.blend /absolute/path/obstetric-learning
blender --background --python scripts/inspect_face.py -- /absolute/path/obstetric-learning
```

座標以母體為基準：網頁 +X 為左、+Y 為頭側、+Z 為前。Blender 對應 `(X, -Z, Y)`。胎兒未旋轉時枕部朝 +Z，LOA／LOT／LOP 分別旋轉 +45／+90／+135 度，ROA／ROT／ROP 分別為 -45／-90／-135 度。攝影機旋轉不改變答案。這組方向契約有自動測試。

## 階段回看

2026-10-15 完成第一個可操作切片。使用者已接受更新後骨盆與整體造型，臉部依後續意見修整。整體教學內容仍由使用者本人定稿；這筆視覺回饋不視為所有醫學內容已核准。

已檢查：三步教學、六個胎位、OA／OP 補充、無效代號、錯誤解說、正確答案、重試、六題摘要、重整續作、清除取消與確認、摘要下載、模型視角／縮放／標註；桌面和 390px 手機視窗。自動測試涵蓋母體方向、六題不重複、輸入正規化、回饋、重複提交、重試與毀損資料復原。

待階段驗收：使用者逐一核對六胎位與教學文字；iPhone Safari、Android Chrome、iPad Safari 真實裝置手勢與效能；教師實際試教。電腦視窗測試不替代實機驗收。

後續依原規格逐關完成分娩機轉、胎心率、觸診與監測。共用本網站入口、儲存和互動元件，不與現有產房模擬聯動。

## 分娩機轉（M3）

重新調查 GitHub 分娩模擬專案，檢視指定 commit 與資產授權，未找到可直接用於本次七段教學的完整資產。候選、版本、採用理由及教學文獻保存於 `docs/birth-resource-audit.json`。骨盆沿用已接受的 HRA 女性骨盆，胎兒骨架與動畫以 Blender 自製。

`src/birth-poses.json` 是版本化動作來源；Blender 烘焙為 42 秒的 `Birth_Sequence`，連續示範與分段操作共用它。`assets-source/birth-mechanism-rig.blend` 保留可編輯骨架，`public/models/birth-fetus.glb` 為分娩專用資產，不覆寫胎位模組。

```sh
blender --background --python scripts/build_birth_rig.py -- /absolute/path/obstetric-learning
blender --background --python scripts/inspect_birth.py -- /absolute/path/obstetric-learning /absolute/path/review-output --all-frames --no-render --strict
```

頭頸採漸變權重，頭與手分開綁定。動畫只供單一 LOA 教學示意，不提供真實尺寸、產程預測、接生拉力、軟組織或接觸力學模擬。幾何檢查只能排查既定動畫的穿模，不能視為臨床驗證。模型比率與位移均為正規化示意值。

操作紀錄使用獨立 `obstetric-learning.birth.v1`，保存各段完成、首次結果、重試、提示及排序紀錄，可下載 JSON 摘要。觀看動畫不計入操作完成；清除本模組不影響胎位紀錄。QR code 依最新指示延後統一製作。

完整製作規格以 `scripts/build_spec.py` 產生於工作區 `output/`，保留原四模組全階段，新增 M3 的資源、Blender、逐段互動、保存及驗收細項。

2026-10-15 依第七段穿骨回報修正分娩專用比例與路徑。先沿通道下降，身體通過後再向前移；一併修正內轉與外轉過渡。全程 0–1260 影格的頭、頸及軀幹表面與八個骨盆組件相交數皆為零。檢查方法、範圍及輸入 SHA-256 保存在 `docs/birth-geometry-review.json`；並非接觸力學或臨床驗證。

分娩模組已檢查七段操作、兩段控制先後、錯答重試、排序錯誤與正確、首次結果、下載、續作、減少動態及清除隔離；桌面與 390×844 手機視窗。連同胎位模組 13 項自動測試通過，真實行動裝置與醫學內容仍按規格逐段驗收。
