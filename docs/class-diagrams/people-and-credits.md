# People & Credits

Covers persons and their cast/crew credits for movies.

```plantuml
@startuml PeopleAndCredits
hide circle
hide empty members
skinparam classAttributeIconSize 0
skinparam linetype ortho

class Person {
  +id: uuid
  original_id: int
  name: varchar
  biography: text?
  birthday: date?
  place_of_birth: varchar?
  profile_image?: {
    url: string
    alt: string
  }
}

class Movie {
  +id: uuid
  title: varchar
}

class MovieCast {
  +id: uuid
  character: varchar?
  order: int?
}

class MovieCrew {
  +id: uuid
  department: varchar
  job: varchar?
}

' Relationships
Movie "1" -- "*" MovieCast : cast
MovieCast "*" --> "1" Person : person

Movie "1" -- "*" MovieCrew : crew
MovieCrew "*" --> "1" Person : person

@enduml
```
