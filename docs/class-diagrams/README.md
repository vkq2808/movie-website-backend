# Backend Entity Class Diagrams

This folder contains PlantUML class diagrams for the backend entities, grouped by functional areas. Each diagram shows key classes, notable properties, and relationships (1-1, 1-N, N-M) within and across groups.

Diagrams are embedded using PlantUML code blocks. You can render them using VS Code PlantUML extensions or any PlantUML tool.

## Index

- Catalog (Movies, Genres, Languages, Keywords, Images, Videos, Production Companies)
	- `catalog.md`
- People & Credits (Persons, Cast, Crew)
	- `people-and-credits.md`
- Availability & Providers (Watch Providers, Movie Watch Providers)
	- `availability-and-providers.md`
- User & Activity (Users, Chats, Feedbacks, Search/Watch History, Recommendations)
	- `user-and-activity.md`
- Commerce & Payments (Payments, Wallets, Purchases)
	- `commerce-and-payments.md`
- System (System Settings)
	- `system.md`

Notes:
- Only representative fields are shown to keep diagrams readable (IDs and important attributes).
- Cross-group relationships are included where relevant (e.g., User favorites Movie, Movie purchases, etc.).
- If you see unknown or inferred types, check the entity definitions under `be/src/modules/*` for full details.

## Enumerations referenced

These enums are referenced in diagrams for clarity; consult the codebase under `be/src/common/enums` for exact members:
- MovieStatus
- ResourceType
- Role
- PaymentMethod
- PaymentStatus
- AvailabilityType
- RecommendationType
- RecommendationSource

