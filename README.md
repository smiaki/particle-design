# Particle design株式会社 — Corporate Site

Particle design株式会社の1ページ型コーポレートサイト。

構想を、事業・業務・データ・技術へ翻訳し、社会実装できる形に変換する事業共創スタジオ。
真っ白な背景、大きな余白、強いコピー、静かなスクロール体験で構成する。

## Core Copy

> 粒子レベルで、ビジネスをデザインする。
> 構想を、社会実装できる事業へ。

## Visual Direction

- white background / large whitespace / typography-first layout
- calm and intelligent visual rhythm, thin gray rules, restrained card UI
- minimal decoration / quiet particle, dot, line, structure, network motifs
- smart, calm, precise, thoughtful, implementation-oriented, trustworthy
- minimal but not empty / modern but not trendy / strategic but not abstract

### Do Not
generic DX visuals, neon, futuristic city, AI brain / robot motifs, flashy blue
gradients, heavy glassmorphism, stock business / handshake / office / people photos,
decorative illustrations that overpower copy, excessive animation, dark cyberpunk,
generic SaaS-template layouts.

## Page Structure

1. Header
2. Hero
3. Intro / Philosophy
4. Problem
5. What We Do
6. Service Areas
7. Approach
8. Founder's Track Record
9. Proof of Execution
10. Future Eggs
11. Founder
12. Company
13. Contact CTA
14. Footer

Narrative: Philosophy → Problem → Value Proposition → Service Areas → Approach →
Founder's Track Record → Proof of Execution → Future Possibilities → Founder → Contact.

---

# Phase 2 — ParticleStage

固定背景の `ParticleStage` を実装する。本文が主役、Particleは意味を補助する静かな背景演出。

## 要件

- Canvas または SVG で実装（**Three.js / WebGL は使わない**）
- `position: fixed` の背景レイヤーとして表示
- `pointer-events: none`
- z-index は本文より背面（本文 z-index:1 / Stage z-index:0）
- 本文の可読性を邪魔しない
- 粒子数は控えめ／色は薄いグレー・ブルーグレー・控えめなシアン程度
- スマホでは粒子数を減らす
- `prefers-reduced-motion` に配慮（静止に近い表現を許容）
- パフォーマンスを重視（再描画を最小化、軽量に保つ）

## 最小構成

- 背景に薄い粒子を配置
- 粒子同士を細い線で接続
- ゆっくり動く（スクロール中も邪魔にならない）
- 現在の `data-scene` を取得できる仕組みを用意する

## data-scene 連動

各 section の `data-scene` を Intersection Observer で監視し、現在表示中の
scene を ParticleStage に渡して、scene に応じて粒子の状態を**少しだけ**変える。

| scene | 方向性 |
|---|---|
| hero | 散らばった粒子がゆっくり集まり始める |
| intro | 粒子が3つの概念グループに分かれる |
| problem | 線が少し途切れ、構想と実装の断絶を表す |
| what-we-do | 粒子が秩序ある構造に変わる |
| service | 構造が5領域に分岐する |
| approach | 粒子がプロセスライン状に並ぶ |
| track-record | ノードがタイムライン状に並ぶ |
| proof | ノードが安定した構造体になる |
| future-eggs | 粒子が小さな核・卵のように集まる |
| founder | 演出をかなり抑える |
| company | 演出をかなり抑える |
| contact | 粒子がCTA周辺へ静かに収束する |

演出強度: Future Eggs=中程度 / Founder・Company=最も弱い / Contact=やさしく集中。
動きはゆっくり（10〜20秒単位）、変化に気づく程度に留める。

## 完了条件

fixed背景で動作 / sectionごとに scene 切替 / PCで自然 / スマホで軽い / 本文を邪魔しない。
成功の基準は "派手さ" ではなく、"静かに意味が伝わること"。

---

## このリポジトリの実装

技術スタック想定は Next.js / TypeScript / Tailwind だが、本プロトタイプは
意図と挙動を素早く確認するための **単一HTMLプロトタイプ** として実装している。

- `index.html` — 本文レイヤー（全14セクション、各 section に `data-scene`）
- `styles.css` — デザインシステム（タイポ・カラー・余白・カードUI）
- `particle-stage.js` — ParticleStage（Canvas粒子エンジン + scene検知）
- `site.js` — ヘッダー状態 / セクションreveal / ナビ開閉

### 要確認のプレースホルダー
設立年月・所在地・連絡先・代表略歴の詳細は仮置き。確定情報を支給ください。
