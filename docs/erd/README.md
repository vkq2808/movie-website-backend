# ERD Diagrams

This folder provides ERDs in two formats:

1) PlantUML (editable in Markdown)
	- content.md — Movies, Genres, People, Companies, Keywords, Languages, Videos, Images, Watch Providers
	- commerce.md — Users, Wallets, Payments, Purchases, Favorites
	- activity.md — Feedback, WatchHistory, SearchHistory, Recommendations, Chat

	Preview: install the “PlantUML” extension (jebbs.plantuml) in VS Code and open the files.

2) Graphviz DOT (exact geometric shapes, e.g., triangle/diamond)
	- dot/content.dot
	- dot/commerce.dot
	- dot/activity.dot

	Preview from terminal (requires graphviz):
	- PNG: dot -Tpng be/docs/erd/dot/activity.dot -o activity.png
	- SVG: dot -Tsvg be/docs/erd/dot/activity.dot -o activity.svg

Notes
- GitHub doesn’t render PlantUML or DOT by default. Use VS Code preview or export images.
- DOT files use varied shapes (diamond/triangle/ellipse) to differentiate entity roles at a glance.
