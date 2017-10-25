import _ from 'underscore';
import { fieldMaps } from '../init/tables';

/*
dumbdown.js

A light wrapper library to turn normal SQL into Salesforce Smart SQL

Allows for developers to write a platform independent backend that can be
transitioned to another DBMS, or use it purely to be able to write SQL in a
format that we all are comfortable with.

NOTE: Smart SQL has limited functionality.  Therefore your SQL will only be
allowed to be so complicated.  Please follow the manual below.


MANUAL:

Smart SQL is for read only queries and therefore SELECT statements only.

This library allows for the following:
    SELECT,
    FROM,
    WHERE,
    GROUP BY,
    ORDER BY,
    LIMIT,
    JOIN (NOTE: do not attempt to write JOINs with JOIN keyword, for now it's old world syntax)

The query matching and replacing is done with regexes looking for the above
keywords.  Therefore, functions such as COALESCE, COUNT, AVG, SUM and other
features within SQL may continue to work (they have not been tested, so please
attempt at your own risk).  This library logs its return string right before
passing the wrapped string to your code so please check your queries to make
sure they look as you want them to.  This library was built to allow developers
to write queries easier, but not to allow you to ignore the SF docs, you must
still have knowledge of Smart SQL to write these queries.  Whatever SF allows,
we try to allow here.  This library is case insensitive.

Examples:

WHERE
Input:
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

Output:
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


JOIN
Input:
SELECT
    user.id,
    user.name,
    profile.address
FROM
    user,
    profile
WHERE
    user.id = profile.user_id

Output:
SELECT
    {user.Id},
    {user.Name},
    {profile.Address__c}
FROM
    {user},
    {profile}
WHERE
    {user:Id} = {profile:UserId}


GROUPS AND ORDERS:
Input:
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

Output:
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
*/


/*
Grab and split lists along their commas.
This is used grab a comma separated list and
split up the SELECT fields and the FROM table names.
*/
const splitFields = (queryString, regex, returnIdx) => queryString.match(regex)[returnIdx].replace(/\s/g, '').split(',');

/*
Takes SQL fields and turns them into Smart SQL fields (or is it Dumb SQL?)
Needs 'fieldMaps' to map from generic field names to SF objects.
user.name => {User:Name}
id => {Account:Id}
program.description => {Program__c:Description__c}
*/
const dumbifyField = (field, tables) => {
    if (field.indexOf('.') > -1) {
        const tableName = field.split('.')[0],
            fieldName = field.split('.')[1];
        return `{${tableName}:${fieldMaps[tableName][fieldName]}}`;
    }
    return `{${tables[0]}:${fieldMaps[tables[0]][field]}}`;
};

/*
Adds a preceeding comma for a list in part of a query if it is not
the first thing in the list.
*/
const commafy = (wholeWrapped, wrapped) => !wholeWrapped.length ? wrapped : `${wholeWrapped}, ${wrapped}`; // eslint-disable-line no-confusing-arrow

/*
Grabs the SELECT part of a SQL string and wraps it in Dumb SQL before
returning the dumb version.
*/
const wrapSelects = (queryString) => {
    const selectFields = splitFields(queryString, /(SELECT)(.+?)(?=FROM)/i, 2),
        tableList = splitFields(queryString, /(FROM)(.+?)(?=WHERE|GROUP BY|ORDER BY|LIMIT|$)/i, 2);

    let wrappedSelects = '';
    _.each(selectFields, (field) => {
        const wrapped = field.indexOf('*') > -1 ? field : dumbifyField(field, tableList);
        wrappedSelects = commafy(wrappedSelects, wrapped);
    });
    return `SELECT ${wrappedSelects} `;
};

/*
Grabs the FROM part of a SQL string and wraps it in Dumb SQL before
returning the dumb version.
*/
const wrapFrom = (queryString) => {
    const tables = splitFields(queryString, /(FROM)(.+?)(?=WHERE|GROUP BY|ORDER BY|LIMIT|$)/i, 2);
    let wrappedFrom = '';
    _.each(tables, (table) => {
        wrappedFrom = commafy(wrappedFrom, `{${table}}`);
    });
    return ` FROM ${wrappedFrom} `;
};

/*
Grabs a part of a SQL string generally and wraps the field list in Dumb SQL
before returning the dumb version.
*/
const wrapSimpleList = (clause, regex, queryString) => {
    const fields = splitFields(clause, regex, 1),
        tableList = splitFields(queryString, /(FROM)(.+?)(?=WHERE|GROUP BY|ORDER BY|LIMIT|$)/i, 2);
    let wrappedFields = '';
    _.each(fields, (field) => {
        wrappedFields = commafy(wrappedFields, dumbifyField(field, tableList));
    });

    return wrappedFields;
};

/*
Grabs the WHERE part of a SQL string and wraps it in Dumb SQL before
returning the dumb version.
*/
const wrapWhere = (whereClause, queryString) => {
    const smallerClauses = whereClause.match(/(?:WHERE)(.+)/i)[1].split('AND'),
        tableList = splitFields(queryString, /(FROM)(.+?)(?=WHERE|GROUP BY|ORDER BY|LIMIT|$)/i, 2);
    let wrappedWhere = '';
    _.each(smallerClauses, (clause, index) => {
        if (clause.indexOf('=') > -1) {
            const stripped = clause.replace(/\s/g, '').split('='),
                left = stripped[0],
                right = stripped[1];
            let expression = dumbifyField(left, tableList);
            if (right.indexOf("'") > -1) {
                expression += ` = ${right}`;
            } else {
                let isTable = false;
                _.each(tableList, (t) => {
                    if (right.indexOf(t) > -1) {
                        isTable = true;
                    }
                });

                if (isTable) {
                    expression += ` = ${dumbifyField(right, tableList)}`;
                } else {
                    let isField = false;
                    _.each(_.keys(fieldMaps[tableList[0]]), (f) => {
                        if (right.indexOf(f) > -1) {
                            isField = true;
                        }
                    });

                    if (isField) {
                        expression += ` = {${tableList[0]}:${fieldMaps[tableList[0]][right]}}`;
                    } else {
                        expression += ` = ${right}`;
                    }
                }
            }
            wrappedWhere = index === 0 ? expression : `${wrappedWhere} AND ${expression} `;
        } else {
            const word = clause.match(/[^\s]+/)[0],
                stripped = clause.replace(word, dumbifyField(word, tableList));
            wrappedWhere = index === 0 ? stripped : `${wrappedWhere} AND ${stripped} `;
        }
    });
    return wrappedWhere;
};

/*
Grabs the qualifier portion of a SQL string, breaks it into relevant parts
and delegates to its child functions to be wrapped in Dumb SQL.
*/
const wrapQualifiers = (queryString) => {
    const remainingClauses = queryString.match(/(WHERE|GROUP BY|ORDER BY|LIMIT|$)(.+?)(?=WHERE|GROUP BY|ORDER BY|LIMIT|$)/ig);
    let wrappedQualifiers = '';

    _.each(remainingClauses, (clause) => {
        if (clause.toLowerCase().startsWith('where')) {
            wrappedQualifiers += ` WHERE ${wrapWhere(clause, queryString)} `;
        } else if (clause.toLowerCase().startsWith('group by')) {
            wrappedQualifiers += ` GROUP BY ${wrapSimpleList(clause, /(?:GROUP BY)(.+)/i, queryString)} `;
        } else if (clause.toLowerCase().startsWith('order by')) {
            wrappedQualifiers += ` ORDER BY ${wrapSimpleList(clause, /(?:ORDER BY)(.+)(?=DESC|ASC)/i, queryString)} `;
            if (clause.toLowerCase().indexOf('asc') > -1) {
                wrappedQualifiers += ' ASC';
            } else if (clause.toLowerCase().indexOf('desc') > -1) {
                wrappedQualifiers += ' DESC';
            }
        } else {
            wrappedQualifiers += ` ${clause}`;
        }
    });

    return wrappedQualifiers;
};

/*
Library entry point
*/
const dumbdown = (queryString) => {
    const selectPortion = wrapSelects(queryString),
        fromPortion = wrapFrom(queryString),
        qualifierPortion = wrapQualifiers(queryString);
    return selectPortion + fromPortion + qualifierPortion;
};

export default dumbdown;
