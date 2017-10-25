# dumbdown.js

### A light wrapper library to turn normal SQL into Salesforce Smart SQL

Dumbdown.js allows for developers to write a platform independent backend that can be transitioned to another DBMS, or use it purely to be able to write SQL in a format that we all are comfortable with.

### NOTE:

Smart SQL has limited functionality.  Therefore your SQL will only be allowed to be so complicated.  Please follow the manual below.

## MANUAL:

- Smart SQL is for read only queries and therefore SELECT statements only.
- This library is case insensitive.
- This library allows for the following:

```
    SELECT,
    FROM,
    WHERE,
    GROUP BY,
    ORDER BY,
    LIMIT,
    JOIN (NOTE: do not attempt to write JOINs with JOIN keyword, for now it's old world syntax)
```

The query matching and replacing is done with regexes looking for the above
keywords.  Therefore, functions such as COALESCE, COUNT, AVG, SUM and other
features within SQL may continue to work (they have not been tested, so please
attempt at your own risk).  This library logs its return string right before
passing the wrapped string to your code so please check your queries to make
sure they look as you want them to.  This library was built to allow developers
to write queries easier, but not to allow you to ignore the Salesforce docs, you must
still have knowledge of Smart SQL to write these queries.  Whatever Salesforce allows,
we try to allow here.

## Examples:

#### WHERE

- Input:
```
SELECT
    id,
    full_name
FROM
    user
WHERE
    first_name = 'John'
AND
    last_name = 'Smith'
LIMIT 100
```
- Output:
```
SELECT
    {user:Id},
    {user:FullName__c}
FROM
    {user}
WHERE
    {user:FirstName__c} = 'John'
AND
    {user:LastName__c} = 'Smith'
LIMIT 100
```

#### JOIN

- Input:
```
SELECT
    user.id,
    user.name,
    profile.address
FROM
    user,
    profile
WHERE
    user.id = profile.user_id
```
- Output:
```
SELECT
    {user.Id},
    {user.Name},
    {profile.Address__c}
FROM
    {user},
    {profile}
WHERE
    {user:Id} = {profile:UserId}
```

#### GROUPS AND ORDERS:

- Input:
```
SELECT
    id,
    date,
    time,
    subject
FROM
    meetings
GROUP BY
    date
ORDER BY
    time
```
- Output:
```
SELECT
    {meetings:Id},
    {meetings:Date},
    {meetings:Event_Time__c},
    {meetings:Subject__c}
FROM
    {meetings}
GROUP BY
    {meetings:Date}
ORDER BY
    {meetings:Event_Time__c}
```
