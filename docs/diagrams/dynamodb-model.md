# DynamoDB modeling

Two tables, each with its own business key — no single-table design.
Full rationale in [`docs/PRD.md`, §4.1.4](../PRD.md).

```mermaid
flowchart TB
    subgraph Users["Users table"]
        U["PK: email<br/>userId, passwordHash, createdAt"]
        UGSI["GSI byUserId<br/>PK: userId<br/>(used by GET /auth/me)"]
    end

    subgraph Products["Products table"]
        P["PK: productId<br/>name, nameLower, category, active"]
        PGSI1["GSI byCategoryActive<br/>PK: gsi1pk = category#active<br/>SK: nameSortKey<br/>(filter by category)"]
        PGSI2["GSI byActive<br/>PK: gsi2pk = active<br/>SK: nameSortKey<br/>(whole catalog, no category)"]
    end
```

## Index decision on listing (`GET /v1/products`)

```mermaid
flowchart TD
    A["GET /v1/products?category=&namePrefix=&cursor="] --> B{"Category filter present?"}
    B -- yes --> C["Query on byCategoryActive<br/>gsi1pk = category#true"]
    B -- no --> D["Query on byActive<br/>gsi2pk = true"]
    C --> E{"Name filter present?"}
    D --> E
    E -- yes --> F["+ begins_with(nameSortKey, prefix)"]
    E -- no --> G["No additional filter"]
    F --> H["ExclusiveStartKey = decode(cursor)"]
    G --> H
    H --> I["Query on DynamoDB, Limit=20"]
    I --> J["next_cursor = encode(LastEvaluatedKey)"]
```

`active` embedded right in the partition key of both product GSIs
avoids a `FilterExpression` — an inactive product simply isn't in the
partition being queried, instead of being filtered out after being
read (and billed for). No listing query ever uses `Scan`.
