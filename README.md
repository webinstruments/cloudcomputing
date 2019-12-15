# PaaS Cloud Computing example
Small rest service to create, modify and delete Snippet entries

## Endpoints
* GET /snippets
```
retrieve multiple snippets filtered by their attributes id, name, author, description, tags, ...
```
* GET /snippets/${id}
```
retrieve JSON of snippet
```
* POST /snippets
```
create a new snippet entity with a JSON object
```
eg: 
```
{
    "name": "snippet-A",
    "description": "description A",
    "author": "author A",
    "language": "language A",
    "code": "code A",
    "tags": [
        "tagA1",
        "tagA2"
    ]
}
```
* PUT /snippets/${id}
```
update snippet entity with a JSON object
```
eg: 
```
{
    "id": 17,
    "name": "snippet-A",
    "description": "description A",
    "author": "author A",
    "language": "language A",
    "code": "code A",
    "tags": [
        "tagA1",
        "tagA2"
    ]
}
```
* DELETE /snippets/${id}
```
removes a specific entity of snippets
```
