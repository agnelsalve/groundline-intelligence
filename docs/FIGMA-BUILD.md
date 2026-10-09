# Building the A4 Figma board (about 10 minutes)

Every panel is a finished PNG at 2× resolution in [`figma/`](figma/). You only need to place them on the board, not design anything.

1. In Figma, choose **New design file** and name it `Salve_Agnel_A4_Groundline_v2`.
2. Drag these files onto the canvas in this order, left to right, with about 200 px between them:

| # | File | Board section (assignment requirement) |
|---|---|---|
| 1 | `figma/1_executive_summary.png` | **Executive summary** (one page): problem, approach, sample outputs, metrics, business value, "Built with n8n + Gemini" badge |
| 2 | `figma/5_architecture.png` | **Technical architecture**: data flow, AI components labeled, integration points, failure paths |
| 3 | `figma/4_scale_testing.png` | **Scale testing**: real results and breaking points |
| 4 | `figma/3_output_gallery.png` | **Output gallery**: 14 examples |
| 5 | `figma/2_before_after.png` | **Before/after** comparison with A3 |
| 6 | your Gmail screenshots in `img/` | Proof the emails arrived |
| 7 | `img/n8n_*.png` | The workflow in n8n |

3. Select each image and press **Ctrl+Alt+G** to wrap it in a frame. Name the frames like the sections above.
4. **Add a "Files" text box** with links to:
   - the GitHub repo or PR;
   - `workflow/workflow_v2.json`;
   - `scale_test_results.md`;
   - `docs/demo_walkthrough.pdf`;
   - the `outputs/` folder.

   The assignment says these files are "linked from Figma".
5. Click **Share** and set **Anyone with the link → can view**. Copy the link for Canvas.
6. **For an editable version** (optional): drag in `architecture.svg` instead of the PNG. Every box and label stays editable.
