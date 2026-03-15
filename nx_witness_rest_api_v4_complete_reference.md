# NX Witness VMS REST API v4 Complete Reference

## Table of Contents

1. [Quick Reference & Conventions](#quick-reference)
1. [Login](#login) (9 endpoints)
1. [Site](#site) (25 endpoints)
1. [Cloud](#cloud) (8 endpoints)
1. [Servers](#servers) (43 endpoints)
1. [Server Data](#server-data) (42 endpoints)
1. [Devices](#devices) (32 endpoints)
1. [Device Media](#device-media) (18 endpoints)
1. [Device PTZ](#device-ptz) (15 endpoints)
1. [Virtual Devices](#virtual-devices) (11 endpoints)
1. [Users](#users) (7 endpoints)
1. [User Groups](#user-groups) (7 endpoints)
1. [Licenses](#licenses) (5 endpoints)
1. [Layouts](#layouts) (12 endpoints)
1. [Showreels](#showreels) (6 endpoints)
1. [Lookup Lists](#lookup-lists) (6 endpoints)
1. [Video Walls](#video-walls) (6 endpoints)
1. [Stored Files](#stored-files) (4 endpoints)
1. [Web Pages](#web-pages) (6 endpoints)
1. [Events](#events) (19 endpoints)
1. [LDAP](#ldap) (8 endpoints)
1. [Analytics](#analytics) (39 endpoints)
1. [Metrics](#metrics) (4 endpoints)
1. [Update](#update) (9 endpoints)
1. [Utilities](#utilities) (11 endpoints)
1. [Legacy/Beta API](#legacybeta-api)
1. [Analytics API Callbacks](#analytics-api-callbacks)
1. [Event Schemas Reference](#event-schemas-reference)

---

# NX Witness VMS REST API v4 Reference (VMS 6.1+)

> **Server:** `https://<server_ip>:<port>` (default port: 7001)  
> **API Version:** REST v4  
> **OpenAPI Version:** 3.0.0  
> **⚠️ IMPORTANT:** All API requests MUST use **HTTPS** (not HTTP). HTTP requests for authenticated endpoints are forbidden.

---

## Quick Reference: Key Facts for AI Agents

### Authentication
- **Session Token** (recommended): `Authorization: Bearer <token>` - HTTPS only
- Obtain token via: `POST /rest/v4/login/sessions` (requires username + password)
- Token is returned in response field `token`
- Use token in all subsequent requests: `Authorization: Bearer <session_token>`

### Time Format
- **All timestamps are in milliseconds since Unix epoch (ms)**
- Example: `synchronizedTimeMs`, `osTimeMs`, `startTimeMs`, `durationMs`
- Server time available at: `GET /rest/v4/servers/{id}/runtimeInfo` → field `synchronizedTimeMs`

### Common Response Parameters
All GET endpoints support these optional query parameters:
- `_format` - Response format: `json`, `xml`, `csv`
- `_pretty` - Pretty-print JSON response
- `_with` - Return only specified fields (comma-separated, e.g. `_with=id,name`)
- `_filter` - Filter results by field value (e.g. `_filter.status=Online`)
- `_stripDefault` - Omit fields with default values
- `_keepDefault` - Include fields with default values
- `_local` - Return data from local server only
- `_ticket` - Use ticket-based auth token instead of Bearer

### ID Format
- All resource IDs are UUIDs in curly-brace format: `{00000000-0000-0000-0000-000000000000}`
- Example: `{"id": "{a1b2c3d4-e5f6-7890-abcd-ef1234567890}"}`

### Wildcard Endpoints
- Paths with `*` (e.g. `/rest/v4/servers/*/info`) return data from **all servers** in the site
- Paths with `{id}` return data from a **specific server**

### Error Response Format
```json
{
  "error": "ErrorType",
  "errorId": "specificErrorId",
  "errorString": "Human readable description",
  "resultCode": 400
}
```

### HTTP Methods Summary
- **GET** - Retrieve data (read-only)
- **POST** - Create new resource or trigger action
- **PUT** - Replace/set entire resource
- **PATCH** - Partially update resource  
- **DELETE** - Remove resource

---

## General API Conventions

### Encryption
- The Server processes requests via **HTTPS** and **RTSPS** (HTTP and RTSP over encrypted connection)
- Supported protocols: **TLS 1.1** and **TLS 1.2** (default)
- Deprecated (disabled by default): SSL 3, TLS 1.0
- **Authenticated endpoints MUST use HTTPS**

### Authentication Methods

#### 1. HTTP Bearer (Session Token) - Recommended
```
Authorization: Bearer <session_token>
```

**Getting a session token (Local/LDAP users):**
```http
POST /rest/v4/login/sessions HTTP/1.1
Content-Type: application/json

{"username": "admin", "password": "yourpassword"}
```
Response: `{"token": "vmsSession-...", ...}`

**Using the token:**
```http
GET /rest/v4/devices HTTP/1.1
Authorization: Bearer vmsSession-00000000111122223333444444444444-abcdefghij
```

#### 2. Ticket-based Authentication
For URL-based auth (e.g., media streams):
```http
POST /rest/v4/login/tickets HTTP/1.1
Authorization: Bearer <session_token>

# Response:
{"token": "vmsTicket-...", ...}

# Usage:
GET /rest/v4/devices?_ticket=vmsTicket-... HTTP/1.1
```

#### 3. Video Wall Authentication
```
Authorization: Bearer videoWall-{00000000-1111-2222-3333-444444444444}
```

### Administrator API
All administrator API functions require a **fresh session token** (recently confirmed by password). If your token has expired for admin purposes, re-authenticate.

### Response Formats
Responses are JSON by default. Use `_format=xml` or `_format=csv` for other formats.

---

# API Endpoints

## Login

### GET `/rest/v4/login/users/{username}`

**Get User login info**

Retrieves the User type and supported login options for the specified User.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `username` | path | string | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "username": "string",
  "type": "local",
  "methods": "http"
}
```

---

### GET `/rest/v4/login/users`

**Get all Users' login info**

Retrieves the User type and supported login options for all Users in the Site.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "username": "string",
    "type": "local",
    "methods": "http"
  }
]
```

---

### POST `/rest/v4/login/sessions`

**Create login Session**

Logs in to the Site and generates a session token for further request authorization.

> **Permissions:** Authorization is not required.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "username": "admin",
  "password": "password123",
  "setCookie": false,
  "durationS": 100,
  "setSession": false
}
```

*Required fields: `username`, `password`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "username": "string",
  "token": "string",
  "ageS": 0,
  "expiresInS": 0
}
```

---

### GET `/rest/v4/login/sessions`

**Get all login Sessions**

Retrieves all login sessions known to the Site for a given user.
<p>
<b>ATTENTION:</b> If some of the Site servers are Offline or have unstable connection, the
result may be incomplete. Use `_strict` to catch connection problems. The result never
contains Cloud User sessions, they should be handled on the Cloud instead.
</p>

> **Permissions:** Any User with a fresh session, only an administrator can read other User sessions.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `username` | query | string |  | User to read sessions for (requires administrator permissions), empty means current user, explicit `*` means all users in the Site. |
| `serverId` | query | string(uuid) |  | Target server, entire Site if not specified. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "username": "string",
    "token": "string",
    "ageS": 0,
    "expiresInS": 0
  }
]
```

---

### GET `/rest/v4/login/sessions/{token}`

**Get login Session**

Retrieves the session information for the specified token.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `token` | path | string | ✓ | If the value "-" or "current" is used, the token is obtained from the authorization headers. |
| `setCookie` | query | boolean |  | Set HTTP cookie for automatic login by browser. |
| `setSession` | query | boolean |  | Apply `token` to the current WebSocket connection. Useless for HTTP requests. |
| `serverId` | query | string(uuid) |  | Target server, entire Site if not specified. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "username": "string",
  "token": "string",
  "ageS": 0,
  "expiresInS": 0
}
```

---

### DELETE `/rest/v4/login/sessions/{token}`

**Delete login Session**

Terminates the session for the specified token.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `token` | path | string | ✓ | If the value "-" or "current" is used, the token is obtained from the authorization. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/login/temporaryToken`

**Log in Temporary User**

Logs in the Temporary User to the Site and generates a Session Token for further
request authorization.

> **Permissions:** Authorization is not required.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "token": "",
  "setCookie": false
}
```

*Required fields: `token`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "username": "string",
  "token": "string",
  "ageS": 0,
  "expiresInS": 0
}
```

---

### POST `/rest/v4/login/tickets`

**Create authorization Ticket**

Generates a Ticket that can be used for a single request authorization.
The Ticket is valid only for a request to the Server that generated it
and can't be used to access other Servers.

> **Permissions:** Any user with a valid Session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "username": "string",
  "token": "string",
  "ageS": 0,
  "expiresInS": 0
}
```

---

### DELETE `/rest/v4/login/tickets/{token}`

**Delete authorization Ticket**

Invalidates a specific Ticket.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `token` | path | string | ✓ | Token that identifies the Ticket. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Site

### GET `/rest/v4/site/database`

**Dump Site database**

Retrieves the binary dump of the Site database (shared among all Servers).
<br/>
ATTENTION: The database data depends on proprietary database structure and is not
intended for manual modification. This data is only intended for restoring via
`POST /rest/v4/site/database`.

> **Permissions:** Administrator with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/site/database`

**Load Site database**

Loads the Site database (shared among all Servers) from the binary dump provided. The
Server will be restarted after loading.

> **Permissions:** Administrator with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/octet-stream`

```json
"string"
```

**Responses:**

**default**: 

---

### GET `/rest/v4/site/databaseData`

**Inspect Site database**

<p><b>Proprietary.</b></p>Retrieves the structured data of the Site database (shared among all Servers).
<br/>
ATTENTION: The database data depends on the proprietary database structure which may
change in any VMS Server version without further notice. Use at your own risk.
<br/>
ATTENTION: This API function may produce output of significant size, so some of UI
tools like API testing tools may freeze on processing. Consider executing directly in the
browser as a workaround.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "resourceTypes": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "vendor": "string",
      "parentId": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "propertyTypes": [
        {}
      ]
    }
  ],
  "servers": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "url": "string",
      "typeId": "{00000000-0000-0000-0000-000000000000}",
      "networkAddresses": "string",
      "flags": "SF_None",
      "version": "string",
      "systemInfo": "string",
      "authKey": "string",
      "osInfo": "string"
    }
  ],
  "serversUserAttributesList": [
    {
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "serverName": "string",
      "maxCameras": 0,
      "allowAutoRedundancy": false,
      "backupBitrateBytesPerSecond": [
        {}
      ],
      "locationId": 0
    }
  ],
  "cameras": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "url": "string",
      "typeId": "{00000000-0000-0000-0000-000000000000}",
      "mac": "string",
      "physicalId": "string",
      "manuallyAdded": false,
      "model": "string",
      "groupId": "string",
      "groupName": "string",
      "statusFlags": "CSF_NoFlags",
      "vendor": "string"
    }
  ],
  "cameraUserAttributesList": [
    {
      "cameraId": "{00000000-0000-0000-0000-000000000000}",
      "cameraName": "string",
      "userDefinedGroupName": "string",
      "scheduleEnabled": false,
      "motionType": "default",
      "motionMask": "string",
      "scheduleTasks": [
        {}
      ],
      "audioEnabled": false,
      "disableDualStreaming": false,
      "controlEnabled": false,
      "dewarpingParams": "string",
      "minArchivePeriodS": 0,
      "maxArchivePeriodS": 0,
      "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
      "failoverPriority": "Never",
      "backupQuality": "CameraBackupBoth",
      "logicalId": "string",
      "recordBeforeMotionSec": 0,
      "recordAfterMotionSec": 0,
      "backupContentType": "archive",
      "backupPolicy": "byDefault"
    }
  ],
  "users": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "url": "string",
      "typeId": "{00000000-0000-0000-0000-000000000000}",
      "type": "local",
      "isEnabled": false,
      "fullName": "string",
      "email": "string",
      "permissions": "none",
      "groupIds": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "externalId": {
        "dn": "string",
        "syncId": "string"
      },
      "attributes": "readonly",
      "digest": "string",
      "hash": "string",
      "cryptSha512Hash": "string",
      "locale": "en_US",
      "orgGroupIds": [
        "{00000000-0000-0000-0000-000000000000}"
      ]
    }
  ],
  "userGroups": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "description": "string",
      "type": "local",
      "permissions": "none",
      "parentGroupIds": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "attributes": "readonly",
      "externalId": {
        "dn": "string",
        "syncId": "string"
      }
    }
  ],
  "layouts": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Layout",
      "cellAspectRatio": 0,
      "cellSpacing": 0,
      "items": [
        {}
      ],
      "locked": false,
      "fixedWidth": 1,
      "fixedHeight": 1,
      "logicalId": 0,
      "backgroundImageFilename": "string",
      "backgroundWidth": 0,
      "backgroundHeight": 0,
      "backgroundOpacity": 0
    }
  ],
  "videowalls": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video wall",
      "typeId": "{00000000-0000-0000-0000-000000000000}",
      "autorun": false,
      "timeline": false,
      "items": [
        {}
      ],
      "screens": [
        {}
      ],
      "matrices": [
        {}
      ]
    }
  ],
  "rules": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "eventType": "undefinedEvent",
      "eventResourceIds": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "eventCondition": "string",
      "eventState": "Inactive",
      "actionType": "undefinedAction",
      "actionResourceIds": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "actionParams": "string",
      "aggregationPeriod": 0,
      "disabled": false,
      "comment": "string",
      "schedule": "string",
      "system": false
    }
  ],
  "vmsRules": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "eventList": [
        {}
      ],
      "actionList": [
        {}
      ],
      "enabled": false,
      "schedule": [
        {}
      ],
      "comment": "string"
    }
  ],
  "cameraHistory": [
    {
      "serverGuid": "{00000000-0000-0000-0000-000000000000}",
      "archivedCameras": [
        "{00000000-0000-0000-0000-000000000000}"
      ]
    }
  ],
  "licenses": [
    {
      "key": "string",
      "licenseBlock": "string"
    }
  ],
  "discoveryData": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "url": "string",
      "ignore": false
    }
  ],
  "allProperties": [
    {
      "value": "string",
      "name": "string",
      "resourceId": "{00000000-0000-0000-0000-000000000000}"
    }
  ],
  "storages": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "url": "string",
      "typeId": "{00000000-0000-0000-0000-000000000000}",
      "spaceLimit": "string",
      "usedForWriting": false,
      "storageType": "string",
      "addParams": [
        {}
      ],
      "status": "Offline",
      "isBackup": false
    }
  ],
  "resStatusList": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "status": "Offline"
    }
  ],
  "webPages": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Web page",
      "url": "https://example.com"
    }
  ],
  "showreels": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Showreel",
      "items": [
        {}
      ],
      "settings": {
        "manual": false
      }
    }
  ],
  "analyticsPlugins": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "url": "string",
      "typeId": "{00000000-0000-0000-0000-000000000000}"
    }
  ],
  "analyticsEngines": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "parentId": "{00000000-0000-0000-0000-000000000000}",
      "name": "string",
      "url": "string",
      "typeId": "{00000000-0000-0000-0000-000000000000}"
    }
  ]
}
```

---

### GET `/rest/v4/site/transactionLog`

**Read DB Transactions**

<p><b>Proprietary.</b></p>Retrieves Site database transactions. The response structure may change in the future VMS
versions.
<br/>
ATTENTION: This API function may produce output of significant size, so some of UI tools
like API testing tools may freeze on processing. Consider executing directly in the browser
as a workaround.

> **Permissions:** Power User or Administrator with a fresh session if `data` is required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `cloudOnly` | query | `true` |  | Show only the transactions that are synced to the Cloud. |
| `removeOnly` | query | `true` |  | Show only the transactions that remove objects. |
| `withData` | query | `true` |  | Fill response `data` field with transaction data deserialized. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Site database transactions.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "info": {
      "command": "CompositeSave",
      "peerID": "{00000000-0000-0000-0000-000000000000}",
      "persistentInfo": {
        "dbID": "{00000000-0000-0000-0000-000000000000}",
        "sequence": 0,
        "timestamp": {}
      },
      "transactionType": "Unknown",
      "historyAttributes": {
        "author": "{00000000-0000-0000-0000-000000000000}"
      }
    },
    "binaryDataSizeB": 0,
    "_error": "string"
  }
]
```

---

### GET `/rest/v4/site/info`

**Get Site info**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `fetchPendingServersInfo` | query | `true` |  | Flag to fetch addition data from deployment cloud service. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Information about the Site.
```json
{
  "name": "string",
  "customization": "string",
  "version": "string",
  "protoVersion": 0,
  "restApiVersions": {
    "min": "string",
    "max": "string"
  },
  "cloudHost": "string",
  "localId": "{00000000-0000-0000-0000-000000000000}",
  "cloudId": "string",
  "cloudOwnerId": "{00000000-0000-0000-0000-000000000000}",
  "organizationId": "{00000000-0000-0000-0000-000000000000}",
  "servers": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "edgeServerCount": 0,
  "devices": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ldapSyncId": "string",
  "synchronizedTimeMs": 0,
  "pendingServerCount": 0
}
```

---

### GET `/rest/v4/site/other`

**Get info about other Sites**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `showDiscovered` | query | boolean |  | Whether discovered Sites should be in the list. |
| `endpoint` | query | array |  | Endpoint to ping and add into the result. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of records about other Sites.
```json
[
  {
    "name": "string",
    "customization": "string",
    "version": "string",
    "protoVersion": 0,
    "restApiVersions": {
      "min": "string",
      "max": "string"
    },
    "cloudHost": "string",
    "localId": "{00000000-0000-0000-0000-000000000000}",
    "cloudId": "string",
    "cloudOwnerId": "{00000000-0000-0000-0000-000000000000}",
    "organizationId": "{00000000-0000-0000-0000-000000000000}",
    "servers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "edgeServerCount": 0,
    "devices": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "endpoint": "string",
    "status": "compatible",
    "ldapSyncId": "string",
    "synchronizedTimeMs": 0,
    "pendingServerCount": 0
  }
]
```

---

### POST `/rest/v4/site/merge`

**Merge Sites**

Merges two Sites. In case of there are several servers on the merged Site
and they are merged partially then method returns code 202 instead of 200.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "remoteEndpoint": "",
  "remoteSessionToken": "",
  "remoteCertificatePem": "",
  "remoteServerId": "{00000000-0000-0000-0000-000000000000}",
  "takeRemoteSettings": false,
  "mergeOneServer": false,
  "ignoreIncompatible": false,
  "ignoreOfflineServerDuplicates": false,
  "dryRun": false
}
```

*Required fields: `remoteEndpoint`, `remoteSessionToken`*

**Responses:**

**default**: Details about the last Merge operation.
```json
{
  "mergeId": "{00000000-0000-0000-0000-000000000000}",
  "mergeInProgress": false,
  "unmergedServers": [
    {
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "serverName": "string",
      "status": "success",
      "errorMessage": "string"
    }
  ],
  "warnings": [
    "string"
  ]
}
```

---

### GET `/rest/v4/site/merge`

**Get Site merge status**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Details about the last Merge operation.
```json
{
  "mergeId": "{00000000-0000-0000-0000-000000000000}",
  "mergeInProgress": false,
  "unmergedServers": [
    {
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "serverName": "string",
      "status": "success",
      "errorMessage": "string"
    }
  ],
  "warnings": [
    "string"
  ]
}
```

---

### DELETE `/rest/v4/site/merge`

**Finish merge forcefully**

Finish Site merge forcefully. Use with care: data sync will continue but some unmerged data
may be lost.

> **Permissions:** Administrator with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/site/storageEncryption`

**Add Storage encryption key**

Adds a new key to encrypt the media data in the video archive. The key is generated from the
given password and salt. The password must not be empty.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "password": "",
  "makeCurrent": false,
  "salt": "string"
}
```

*Required fields: `password`*

**Responses:**

**default**: The created AES key.
```json
{
  "ivVect": "string",
  "issueDateUs": 0,
  "isCurrent": false
}
```

---

### GET `/rest/v4/site/storageEncryption`

**Get Storage encryption keys**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all AES keys.
```json
[
  {
    "ivVect": "string",
    "issueDateUs": 0,
    "isCurrent": false
  }
]
```

---

### GET `/rest/v4/site/storageEncryption/{ivVect}`

**Get Storage encryption key**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `ivVect` | path | string | ✓ | Id of an AES key represented as the "ivVect" field of the response to `POST /rest/v4/site/storageEncryption` or `GET /rest/v4/site/storageEncryption`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: The requested AES key.
```json
{
  "ivVect": "string",
  "issueDateUs": 0,
  "isCurrent": false
}
```

---

### DELETE `/rest/v4/site/storageEncryption/{ivVect}`

**Delete Storage encryption key**

Deletes the encryption key from the Site database.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `ivVect` | path | string | ✓ | Id of an AES key represented as the "ivVect" field of the response to `POST /rest/v4/site/storageEncryption` or `GET /rest/v4/site/storageEncryption`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/site/resourceData`

**Get Device configuration**

Retrieves the Device configuration file (resource_data.json) which is currently in use.

> **Permissions:** Any User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/site/cleanupTaxonomy`

**Clean up Taxonomy data**

Cleans up the old Taxonomy data. The data remaining from any previous plugin versions will
be lost.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/resourceGroups`

**Get Resource Groups**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "All Devices",
    "description": "All Devices in this VMS Site.",
    "isPredefined": false
  }
]
```

---

### GET `/rest/v4/site/resources/{id}`

**Get Resource info**

Retrieves the specified Resource info in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Resource id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get information about the Resource.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "group": "analyticsEngines",
  "api": "string"
}
```

---

### GET `/rest/v4/site/resources`

**Get all Resources' info**

Retrieves all Resources' info accessible to the User in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get information about all Resources in the Site.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "typeId": "{00000000-0000-0000-0000-000000000000}",
    "group": "analyticsEngines",
    "api": "string"
  }
]
```

---

### GET `/rest/v4/integrations`

**Get Integrations**

Retrieves all Integration records stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Integration records.
```json
[
  {
    "name": "string",
    "description": "string",
    "vendor": "string",
    "version": "string",
    "resourceBindingInfo": [
      {
        "id": "string",
        "name": "string",
        "boundResourceCount": 0,
        "onlineBoundResourceCount": 0
      }
    ],
    "properties": {}
  }
]
```

---

### GET `/rest/v4/integrations/{id}`

**Get Integration**

Retrieves the specified Integration record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | array | ✓ | Flexible id of an Integration or a set of flexible ids. Can be obtained from "id" field via     `GET /rest/v4/integrations` |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Integration record.
```json
{
  "name": "string",
  "description": "string",
  "vendor": "string",
  "version": "string",
  "resourceBindingInfo": [
    {
      "id": "string",
      "name": "string",
      "boundResourceCount": 0,
      "onlineBoundResourceCount": 0
    }
  ],
  "properties": {}
}
```

---

### POST `/rest/v4/site/setup`

**Set up Site**

Sets up this Server to form a new Site. Can only be called if this Server is not a part of
any other Site.

> **Permissions:** Administrator with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Site 1",
  "settingsPreset": "compatibility",
  "local": {
    "password": ""
  },
  "settings": {
    "defaultExportVideoCodec": "",
    "watermarkSettings": {
      "useWatermark": false,
      "frequency": 0,
      "opacity": 0
    },
    "pixelationSettings": {
      "isAllObjectTypes": false,
      "objectTypeIds": [
        ""
      ],
      "intensity": 0,
      "excludeCameraIds": [
        "{00000000-0000-0000-0000-000000000000}"
      ]
    },
    "webSocketEnabled": false,
    "autoDiscoveryEnabled": false,
    "cameraSettingsOptimization": false,
    "statisticsAllowed": false,
    "defaultUserLocale": "",
    "auditTrailEnabled": false,
    "trafficEncryptionForced": false,
    "useHttpsOnlyForCameras": false,
    "videoTrafficEncryptionForced": false,
    "storageEncryption": false,
    "showServersInTreeForNonAdmins": false,
    "updateNotificationsEnabled": false,
    "emailSettings": {
      "email": "",
      "server": "",
      "user": "",
      "password": "",
      "signature": "",
      "supportAddress": "",
      "connectionType": "insecure",
      "port": 0,
      "timeoutS": 0,
      "smtpEhloName": "",
      "useCloudServiceToSendEmail": false
    },
    "timeSynchronizationEnabled": false,
    "primaryTimeServer": "{00000000-0000-0000-0000-000000000000}",
    "customReleaseListUrl": "",
    "clientUpdateSettings": {
      "showFeatureInformer": false,
      "enabled": false,
      "updateEnabledTimestampMs": 0,
      "pendingVersion": "",
      "plannedInstallationDateMs": 0
    },
    "backupSettings": {
      "id": "89abcdef-0123-4567-89ab-cdef01234567",
      "quality": "CameraBackupBoth",
      "backupNewCameras": false
    },
    "metadataStorageChangePolicy": "keep",
    "allowRegisteringIntegrations": false,
    "additionalLocalFsTypes": "",
    "arecontRtspEnabled": false,
    "auditTrailPeriodDays": 0,
    "autoDiscoveryResponseEnabled": false,
    "autoUpdateThumbnails": false,
    "checkVideoStreamPeriodMs": 0,
    "clientStatisticsSettingsUrl": "",
    "cloudConnectRelayingEnabled": false,
    "cloudConnectRelayingOverSslForced": false,
    "cloudConnectUdpHolePunchingEnabled": false,
    "cloudPollingIntervalS": 0,
    "crashReportServerApi": "",
    "crossdomainEnabled": false,
    "currentStorageEncryptionKey": "",
    "defaultVideoCodec": "",
    "deviceStorageInfoUpdateIntervalS": 0,
    "disabledVendors": "",
    "ec2AliveUpdateIntervalSec": 0,
    "enableEdgeRecording": false,
    "eventLogPeriodDays": 0,
    "exposeDeviceCredentials": false,
    "exposeServerEndpoints": false,
    "forceAnalyticsDbStoragePermissions": false,
    "forceLiveCacheForPrimaryStream": "",
    "frameOptionsHeader": "",
    "insecureDeprecatedApiEnabled": false,
    "insecureDeprecatedApiInUseEnabled": false,
    "insecureDeprecatedAuthEnabled": false,
    "installedPersistentUpdateStorage": {
      "servers": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "autoSelection": false
    },
    "installedUpdateInformation": "",
    "keepIoPortStateIntactOnInitialization": false,
    "licenseServer": "",
    "lowQualityScreenVideoCodec": "",
    "masterCloudSyncList": "",
    "maxBookmarks": 0,
    "maxDifferenceBetweenSynchronizedAndInternetTime": 0,
    "maxDifferenceBetweenSynchronizedAndLocalTimeMs": 0,
    "maxEventLogRecords": 0,
    "maxHttpTranscodingSessions": 0,
    "maxP2pAllClientsSizeBytes": "",
    "maxP2pQueueSizeBytes": 0,
    "maxRecordQueueSizeBytes": 0,
    "maxRecordQueueSizeElements": 0,
    "maxRemoteArchiveSynchronizationThreads": 0,
    "maxRtpRetryCount": 0,
    "maxRtspConnectDurationSeconds": 0,
    "maxSceneItems": 0,
    "maxVirtualCameraArchiveSynchronizationThreads": 0,
    "mediaBufferSizeForAudioOnlyDeviceKb": 0,
    "mediaBufferSizeKb": 0,
    "osTimeChangeCheckPeriodMs": 0,
    "proxyConnectTimeoutSec": 0,
    "proxyConnectionAccessPolicy": "disabled",
    "resourceFileUri": "",
    "rtpTimeoutMs": 0,
    "securityForPowerUsers": false,
    "sequentialFlirOnvifSearcherEnabled": false,
    "serverHeader": "",
    "showMouseTimelinePreview": false,
    "statisticsReportServerApi": "",
    "statisticsReportTimeCycle": "",
    "statisticsReportUpdateDelay": "",
    "supportedOrigins": "",
    "syncTimeEpsilon": 0,
    "syncTimeExchangePeriod": 0,
    "targetPersistentUpdateStorage": {
      "servers": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "autoSelection": false
    },
    "targetUpdateInformation": "",
    "upnpPortMappingEnabled": false,
    "useTextEmailFormat": false,
    "useWindowsEmailLineFeed": false,
    "userSessionSettings": {
      "sessionLimitS": 0,
      "sessionsLimit": 0,
      "sessionsLimitPerUser": 0,
      "remoteSessionTimeoutS": 0,
      "remoteSessionUpdateS": 0,
      "remoteSessionUpdateKeysS": 0,
      "useSessionLimitForCloud": false
    }
  },
  "cloud": {
    "authKey": "",
    "owner": "",
    "organizationId": "",
    "siteId": ""
  }
}
```

*Required fields: `name`*

**Responses:**

**default**: 

---

### GET `/rest/v4/site/settings`

**Get Site settings**

> **Permissions:** Any User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Site settings and their values.
```json
{
  "defaultExportVideoCodec": "string",
  "watermarkSettings": {
    "useWatermark": false,
    "frequency": 0,
    "opacity": 0
  },
  "pixelationSettings": {
    "isAllObjectTypes": false,
    "objectTypeIds": [
      "string"
    ],
    "intensity": 0,
    "excludeCameraIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ]
  },
  "webSocketEnabled": false,
  "autoDiscoveryEnabled": false,
  "cameraSettingsOptimization": false,
  "statisticsAllowed": false,
  "defaultUserLocale": "string",
  "auditTrailEnabled": false,
  "trafficEncryptionForced": false,
  "useHttpsOnlyForCameras": false,
  "videoTrafficEncryptionForced": false,
  "storageEncryption": false,
  "showServersInTreeForNonAdmins": false,
  "updateNotificationsEnabled": false,
  "emailSettings": {
    "email": "string",
    "server": "string",
    "user": "string",
    "signature": "string",
    "supportAddress": "string",
    "connectionType": "insecure",
    "port": 0,
    "timeoutS": 0,
    "smtpEhloName": "string",
    "useCloudServiceToSendEmail": false
  },
  "timeSynchronizationEnabled": false,
  "primaryTimeServer": "{00000000-0000-0000-0000-000000000000}",
  "customReleaseListUrl": "string",
  "clientUpdateSettings": {
    "showFeatureInformer": false,
    "enabled": false,
    "updateEnabledTimestampMs": 0,
    "pendingVersion": "string",
    "plannedInstallationDateMs": 0
  },
  "backupSettings": {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "quality": "CameraBackupBoth",
    "backupNewCameras": false
  },
  "metadataStorageChangePolicy": "keep",
  "allowRegisteringIntegrations": false,
  "additionalLocalFsTypes": "string",
  "arecontRtspEnabled": false,
  "auditTrailPeriodDays": 0,
  "autoDiscoveryResponseEnabled": false,
  "autoUpdateThumbnails": false,
  "checkVideoStreamPeriodMs": 0,
  "clientStatisticsSettingsUrl": "string",
  "cloudConnectRelayingEnabled": false,
  "cloudConnectRelayingOverSslForced": false,
  "cloudConnectUdpHolePunchingEnabled": false,
  "cloudPollingIntervalS": 0,
  "crashReportServerApi": "string",
  "crossdomainEnabled": false,
  "currentStorageEncryptionKey": "string",
  "defaultVideoCodec": "string",
  "deviceStorageInfoUpdateIntervalS": 0,
  "disabledVendors": "string",
  "ec2AliveUpdateIntervalSec": 0,
  "enableEdgeRecording": false,
  "eventLogPeriodDays": 0,
  "exposeDeviceCredentials": false,
  "exposeServerEndpoints": false,
  "forceAnalyticsDbStoragePermissions": false,
  "forceLiveCacheForPrimaryStream": "string",
  "frameOptionsHeader": "string",
  "insecureDeprecatedApiEnabled": false,
  "insecureDeprecatedApiInUseEnabled": false,
  "insecureDeprecatedAuthEnabled": false,
  "installedPersistentUpdateStorage": {
    "servers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "autoSelection": false
  },
  "installedUpdateInformation": "string",
  "keepIoPortStateIntactOnInitialization": false,
  "licenseServer": "string",
  "lowQualityScreenVideoCodec": "string",
  "masterCloudSyncList": "string",
  "maxBookmarks": 0,
  "maxDifferenceBetweenSynchronizedAndInternetTime": 0,
  "maxDifferenceBetweenSynchronizedAndLocalTimeMs": 0,
  "maxEventLogRecords": 0,
  "maxHttpTranscodingSessions": 0,
  "maxP2pAllClientsSizeBytes": "string",
  "maxP2pQueueSizeBytes": 0,
  "maxRecordQueueSizeBytes": 0,
  "maxRecordQueueSizeElements": 0,
  "maxRemoteArchiveSynchronizationThreads": 0,
  "maxRtpRetryCount": 0,
  "maxRtspConnectDurationSeconds": 0,
  "maxSceneItems": 0,
  "maxVirtualCameraArchiveSynchronizationThreads": 0,
  "mediaBufferSizeForAudioOnlyDeviceKb": 0,
  "mediaBufferSizeKb": 0,
  "osTimeChangeCheckPeriodMs": 0,
  "proxyConnectTimeoutSec": 0,
  "proxyConnectionAccessPolicy": "disabled",
  "resourceFileUri": "string",
  "rtpTimeoutMs": 0,
  "securityForPowerUsers": false,
  "sequentialFlirOnvifSearcherEnabled": false,
  "serverHeader": "string",
  "showMouseTimelinePreview": false,
  "statisticsReportServerApi": "string",
  "statisticsReportTimeCycle": "string",
  "statisticsReportUpdateDelay": "string",
  "supportedOrigins": "string",
  "syncTimeEpsilon": 0,
  "syncTimeExchangePeriod": 0,
  "targetPersistentUpdateStorage": {
    "servers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "autoSelection": false
  },
  "targetUpdateInformation": "string",
  "upnpPortMappingEnabled": false,
  "useTextEmailFormat": false,
  "useWindowsEmailLineFeed": false,
  "userSessionSettings": {
    "sessionLimitS": 0,
    "sessionsLimit": 0,
    "sessionsLimitPerUser": 0,
    "remoteSessionTimeoutS": 0,
    "remoteSessionUpdateS": 0,
    "remoteSessionUpdateKeysS": 0,
    "useSessionLimitForCloud": false
  },
  "siteName": "string",
  "cloudAccountName": "string",
  "cloudHost": "string",
  "lastMergeMasterId": "string",
  "lastMergeSlaveId": "string",
  "organizationId": "{00000000-0000-0000-0000-000000000000}",
  "statisticsReportLastNumber": 0,
  "statisticsReportLastTime": "string",
  "statisticsReportLastVersion": "string",
  "cloudId": "string",
  "localId": "{00000000-0000-0000-0000-000000000000}",
  "enabled2fa": false
}
```

---

### PATCH `/rest/v4/site/settings`

**Modify Site settings**

Modifies a bunch of Site settings by passing a JSON object with the setting keys and
values in the request body. The existing settings can be obtained in the same format using
the "Get Site settings" function.

> **Permissions:** Administrator or power user (see manifest) with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "siteName": "Site"
}
```

**Responses:**

**default**: 
```json
{
  "defaultExportVideoCodec": "string",
  "watermarkSettings": {
    "useWatermark": false,
    "frequency": 0,
    "opacity": 0
  },
  "pixelationSettings": {
    "isAllObjectTypes": false,
    "objectTypeIds": [
      "string"
    ],
    "intensity": 0,
    "excludeCameraIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ]
  },
  "webSocketEnabled": false,
  "autoDiscoveryEnabled": false,
  "cameraSettingsOptimization": false,
  "statisticsAllowed": false,
  "defaultUserLocale": "string",
  "auditTrailEnabled": false,
  "trafficEncryptionForced": false,
  "useHttpsOnlyForCameras": false,
  "videoTrafficEncryptionForced": false,
  "storageEncryption": false,
  "showServersInTreeForNonAdmins": false,
  "updateNotificationsEnabled": false,
  "emailSettings": {
    "email": "string",
    "server": "string",
    "user": "string",
    "signature": "string",
    "supportAddress": "string",
    "connectionType": "insecure",
    "port": 0,
    "timeoutS": 0,
    "smtpEhloName": "string",
    "useCloudServiceToSendEmail": false
  },
  "timeSynchronizationEnabled": false,
  "primaryTimeServer": "{00000000-0000-0000-0000-000000000000}",
  "customReleaseListUrl": "string",
  "clientUpdateSettings": {
    "showFeatureInformer": false,
    "enabled": false,
    "updateEnabledTimestampMs": 0,
    "pendingVersion": "string",
    "plannedInstallationDateMs": 0
  },
  "backupSettings": {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "quality": "CameraBackupBoth",
    "backupNewCameras": false
  },
  "metadataStorageChangePolicy": "keep",
  "allowRegisteringIntegrations": false,
  "additionalLocalFsTypes": "string",
  "arecontRtspEnabled": false,
  "auditTrailPeriodDays": 0,
  "autoDiscoveryResponseEnabled": false,
  "autoUpdateThumbnails": false,
  "checkVideoStreamPeriodMs": 0,
  "clientStatisticsSettingsUrl": "string",
  "cloudConnectRelayingEnabled": false,
  "cloudConnectRelayingOverSslForced": false,
  "cloudConnectUdpHolePunchingEnabled": false,
  "cloudPollingIntervalS": 0,
  "crashReportServerApi": "string",
  "crossdomainEnabled": false,
  "currentStorageEncryptionKey": "string",
  "defaultVideoCodec": "string",
  "deviceStorageInfoUpdateIntervalS": 0,
  "disabledVendors": "string",
  "ec2AliveUpdateIntervalSec": 0,
  "enableEdgeRecording": false,
  "eventLogPeriodDays": 0,
  "exposeDeviceCredentials": false,
  "exposeServerEndpoints": false,
  "forceAnalyticsDbStoragePermissions": false,
  "forceLiveCacheForPrimaryStream": "string",
  "frameOptionsHeader": "string",
  "insecureDeprecatedApiEnabled": false,
  "insecureDeprecatedApiInUseEnabled": false,
  "insecureDeprecatedAuthEnabled": false,
  "installedPersistentUpdateStorage": {
    "servers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "autoSelection": false
  },
  "installedUpdateInformation": "string",
  "keepIoPortStateIntactOnInitialization": false,
  "licenseServer": "string",
  "lowQualityScreenVideoCodec": "string",
  "masterCloudSyncList": "string",
  "maxBookmarks": 0,
  "maxDifferenceBetweenSynchronizedAndInternetTime": 0,
  "maxDifferenceBetweenSynchronizedAndLocalTimeMs": 0,
  "maxEventLogRecords": 0,
  "maxHttpTranscodingSessions": 0,
  "maxP2pAllClientsSizeBytes": "string",
  "maxP2pQueueSizeBytes": 0,
  "maxRecordQueueSizeBytes": 0,
  "maxRecordQueueSizeElements": 0,
  "maxRemoteArchiveSynchronizationThreads": 0,
  "maxRtpRetryCount": 0,
  "maxRtspConnectDurationSeconds": 0,
  "maxSceneItems": 0,
  "maxVirtualCameraArchiveSynchronizationThreads": 0,
  "mediaBufferSizeForAudioOnlyDeviceKb": 0,
  "mediaBufferSizeKb": 0,
  "osTimeChangeCheckPeriodMs": 0,
  "proxyConnectTimeoutSec": 0,
  "proxyConnectionAccessPolicy": "disabled",
  "resourceFileUri": "string",
  "rtpTimeoutMs": 0,
  "securityForPowerUsers": false,
  "sequentialFlirOnvifSearcherEnabled": false,
  "serverHeader": "string",
  "showMouseTimelinePreview": false,
  "statisticsReportServerApi": "string",
  "statisticsReportTimeCycle": "string",
  "statisticsReportUpdateDelay": "string",
  "supportedOrigins": "string",
  "syncTimeEpsilon": 0,
  "syncTimeExchangePeriod": 0,
  "targetPersistentUpdateStorage": {
    "servers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "autoSelection": false
  },
  "targetUpdateInformation": "string",
  "upnpPortMappingEnabled": false,
  "useTextEmailFormat": false,
  "useWindowsEmailLineFeed": false,
  "userSessionSettings": {
    "sessionLimitS": 0,
    "sessionsLimit": 0,
    "sessionsLimitPerUser": 0,
    "remoteSessionTimeoutS": 0,
    "remoteSessionUpdateS": 0,
    "remoteSessionUpdateKeysS": 0,
    "useSessionLimitForCloud": false
  },
  "siteName": "string",
  "cloudAccountName": "string",
  "cloudHost": "string",
  "lastMergeMasterId": "string",
  "lastMergeSlaveId": "string",
  "organizationId": "{00000000-0000-0000-0000-000000000000}",
  "statisticsReportLastNumber": 0,
  "statisticsReportLastTime": "string",
  "statisticsReportLastVersion": "string",
  "cloudId": "string",
  "localId": "{00000000-0000-0000-0000-000000000000}",
  "enabled2fa": false
}
```

---

### GET `/rest/v4/site/settings/{name}`

**Get Site setting**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | ✓ | Site setting name to retrieve. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Value of the particular Site setting.

---

### PUT `/rest/v4/site/settings/{name}`

**Replace Site setting**

Replaces a single Site setting by passing a JSON value in the request body. The existing
setting values can be obtained using the "Get Site settings" function as a JSON object
with setting values mapped by field names.

> **Permissions:** Administrator or power user (see manifest) with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | ✓ | Site setting name to replace. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
"Site"
```

**Responses:**

**default**: 

---

## Cloud

### POST `/rest/v4/cloud/signature`

**Generate/check Cloud signature**

Generates or checks the Cloud message signature by the Cloud key.

> **Permissions:** Any User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "message": "MESSAGE",
  "signature": ""
}
```

*Required fields: `message`*

**Responses:**

**default**: 
```json
{
  "message": "MESSAGE",
  "signature": "string"
}
```

---

### POST `/rest/v4/cloud/sync`

**Pull data from Cloud**

Initiates the immediate pulling of the data from the Cloud. Does not wait for the current
Cloud polling interval end. Does nothing if the Cloud pulling is already in progress. Cloud
polling interval can be set up using `cloudPollingIntervalS` setting that should be greater
than zero.

> **Permissions:** Authorization is not required.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "waitForDone": false
}
```

**Responses:**

**default**: 
```json
{
  "cdb": {
    "isRunning": false,
    "timeSinceLastSyncMs": 0,
    "message": "string"
  },
  "cps": {
    "isRunning": false,
    "timeSinceLastSyncMs": 0,
    "message": "string"
  },
  "css": {
    "isRunning": false,
    "timeSinceLastSyncMs": 0,
    "message": "string"
  }
}
```

---

### GET `/rest/v4/cloud/sync`

**Cloud pulling status**

Retrieves the status of the Cloud pulling that is initiated each Cloud polling interval or
using `POST /rest/v4/cloud/sync` call. Cloud polling interval can be set up using
`cloudPollingIntervalS` setting that should be greater than zero.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `waitForDone` | query | boolean |  | Wait until the data is processed. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "cdb": {
    "isRunning": false,
    "timeSinceLastSyncMs": 0,
    "message": "string"
  },
  "cps": {
    "isRunning": false,
    "timeSinceLastSyncMs": 0,
    "message": "string"
  },
  "css": {
    "isRunning": false,
    "timeSinceLastSyncMs": 0,
    "message": "string"
  }
}
```

---

### POST `/rest/v4/cloud/sync/{service}`

**Pull data from Cloud service**

Initiates the immediate pulling of the data from the Cloud. Does not wait for the current
Cloud polling interval end. Does nothing if the Cloud pulling is already in progress. Cloud
polling interval can be set up using `cloudPollingIntervalS` setting that should be greater
than zero.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `service` | path | `cdb` \| `cps` \| `css` | ✓ | Possible values are: - `"cdb"` Sync information with Cloud about Cloud users, attributes, settings. - `"cps"` Fetch information about Channel Partner, Organization, available services, send SaaS reports. - `"css"` Fetch information about the Cloud Storage services available. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "waitForDone": false
}
```

**Responses:**

**default**: 
```json
{
  "isRunning": false,
  "timeSinceLastSyncMs": 0,
  "message": "string"
}
```

---

### GET `/rest/v4/cloud/sync/{service}`

**Cloud service pulling status**

Retrieves the status of the Cloud pulling that is initiated each Cloud polling interval or
using `POST /rest/v4/cloud/sync` call. Cloud polling interval can be set up using
`cloudPollingIntervalS` setting that should be greater than zero.

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `service` | path | `cdb` \| `cps` \| `css` | ✓ | Possible values are: - `"cdb"` Sync information with Cloud about Cloud users, attributes, settings. - `"cps"` Fetch information about Channel Partner, Organization, available services, send SaaS reports. - `"css"` Fetch information about the Cloud Storage services available. |
| `waitForDone` | query | boolean |  | Wait until the data is processed. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "isRunning": false,
  "timeSinceLastSyncMs": 0,
  "message": "string"
}
```

---

### GET `/rest/v4/cloud/saas`

**Cloud SaaS state**

Information about SaaS state including available and in use licensing information.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: SaasData from license server.
```json
{
  "channelPartner": {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "string",
    "supportInformation": {
      "sites": [
        {}
      ],
      "phones": [
        {}
      ],
      "emails": [
        {}
      ],
      "custom": [
        {}
      ]
    }
  },
  "organization": {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "string"
  },
  "state": "uninitialized",
  "services": {},
  "tier": {
    "name": "string",
    "maxServersPerSite": 0,
    "maxDevicesPerServer": 0,
    "maxItemsInLayout": 0,
    "maxDaysArchiveLocal": 0,
    "ldapAllowed": false,
    "videoWallAllowed": false,
    "crossSiteAllowed": false
  },
  "security": {
    "checkPeriodS": 0,
    "lastCheck": "string",
    "tmpExpirationDate": "string",
    "status": {}
  },
  "signature": "string",
  "servicesAvailable": {},
  "tierUsages": {
    "servers": 0,
    "maxDevicesPerServer": 0,
    "maxItemsInLayout": 0,
    "ldapUsed": false,
    "videoWallUsed": false
  },
  "tiersOveruse": {
    "maxServersPerSite": {
      "allowed": 0,
      "used": 0
    },
    "maxDevicesPerServer": {
      "allowed": 0,
      "used": 0
    },
    "maxItemsInLayout": {
      "allowed": 0,
      "used": 0
    },
    "maxDaysArchiveLocal": {
      "allowed": 0,
      "used": 0
    },
    "ldapAllowed": {
      "allowed": 0,
      "used": 0
    },
    "videoWallAllowed": {
      "allowed": 0,
      "used": 0
    },
    "crossSiteAllowed": {
      "allowed": 0,
      "used": 0
    }
  }
}
```

---

### POST `/rest/v4/cloud/bind`

**Bind Site to Cloud**

Binds the Site to the Cloud.

> **Permissions:** Administrator with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "authKey": "",
  "owner": "",
  "organizationId": "",
  "siteId": ""
}
```

*Required fields: `authKey`, `owner`, `siteId`*

**Responses:**

**default**: 

---

### POST `/rest/v4/cloud/unbind`

**Unbind Site from Cloud**

Unbinds the Site from the Cloud and sets a new administrator password.

> **Permissions:** Administrator with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "password": ""
}
```

**Responses:**

**default**: 

---

## Servers

### GET `/rest/v4/servers`

**Get Servers**

Retrieves all Server records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Server records.
```json
[
  {
    "parameters": {},
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "Server 1",
    "url": "https://127.0.0.1:7001",
    "version": "string",
    "osInfo": {
      "platform": "string",
      "variant": "string",
      "variantVersion": "string"
    },
    "backupBitrateBytesPerSecond": [
      {
        "key": {},
        "value": "0"
      }
    ],
    "status": "Offline",
    "storages": [
      {
        "parameters": {},
        "id": "{00000000-0000-0000-0000-000000000000}",
        "serverId": "{00000000-0000-0000-0000-000000000000}",
        "name": "Storage 1",
        "path": "string",
        "type": "string",
        "spaceLimitB": 0,
        "isUsedForWriting": false,
        "isBackup": false,
        "status": "Offline",
        "storageArchiveMode": "undefined"
      }
    ],
    "portForwardingConfigurations": [
      {
        "name": "string",
        "port": 0,
        "login": "string",
        "password": "string"
      }
    ],
    "flags": "none",
    "network": {
      "endpoints": [
        "string"
      ],
      "certificatePem": "string",
      "userProvidedCertificatePem": "string",
      "publicIp": "string"
    },
    "settings": {
      "locationId": 0,
      "isFailoverEnabled": false,
      "maxCameras": 0,
      "webCamerasDiscoveryEnabled": false
    },
    "runtimeInformation": {
      "hardwareInformation": {
        "physicalMemoryB": 0,
        "cpuArchitecture": "string",
        "cpuModelName": "string"
      },
      "timezone": {
        "timeZoneOffsetMs": 0,
        "timeZoneId": "string"
      },
      "idConflictDetected": false
    }
  }
]
```

---

### POST `/rest/v4/servers`

**Create Server**

Creates a record in the Site for the new Server.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "",
  "authKey": "",
  "osInfo": {
    "platform": "",
    "variant": "",
    "variantVersion": ""
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": 0
    }
  ],
  "status": "Offline",
  "portForwardingConfigurations": [
    {
      "name": "",
      "port": 0,
      "login": "",
      "password": ""
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      ""
    ],
    "certificatePem": "",
    "userProvidedCertificatePem": "",
    "publicIp": ""
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "",
      "cpuModelName": ""
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": ""
    },
    "idConflictDetected": false
  }
}
```

*Required fields: `name`, `url`*

**Responses:**

**default**: Server record that was created.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "string",
  "osInfo": {
    "platform": "string",
    "variant": "string",
    "variantVersion": "string"
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": "0"
    }
  ],
  "status": "Offline",
  "storages": [
    {
      "parameters": {},
      "id": "{00000000-0000-0000-0000-000000000000}",
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Storage 1",
      "path": "string",
      "type": "string",
      "spaceLimitB": 0,
      "isUsedForWriting": false,
      "isBackup": false,
      "status": "Offline",
      "storageArchiveMode": "undefined"
    }
  ],
  "portForwardingConfigurations": [
    {
      "name": "string",
      "port": 0,
      "login": "string",
      "password": "string"
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      "string"
    ],
    "certificatePem": "string",
    "userProvidedCertificatePem": "string",
    "publicIp": "string"
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "string",
      "cpuModelName": "string"
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": "string"
    },
    "idConflictDetected": false
  }
}
```

---

### GET `/rest/v4/servers/{id}`

**Get Server**

Retrieves the specified Server record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Server record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "string",
  "osInfo": {
    "platform": "string",
    "variant": "string",
    "variantVersion": "string"
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": "0"
    }
  ],
  "status": "Offline",
  "storages": [
    {
      "parameters": {},
      "id": "{00000000-0000-0000-0000-000000000000}",
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Storage 1",
      "path": "string",
      "type": "string",
      "spaceLimitB": 0,
      "isUsedForWriting": false,
      "isBackup": false,
      "status": "Offline",
      "storageArchiveMode": "undefined"
    }
  ],
  "portForwardingConfigurations": [
    {
      "name": "string",
      "port": 0,
      "login": "string",
      "password": "string"
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      "string"
    ],
    "certificatePem": "string",
    "userProvidedCertificatePem": "string",
    "publicIp": "string"
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "string",
      "cpuModelName": "string"
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": "string"
    },
    "idConflictDetected": false
  }
}
```

---

### PUT `/rest/v4/servers/{id}`

**Replace Server**

Replaces all fields of the specified Server record stored in the Site.
Creation of a new Server or modification of some settings requires an `Administrator with a
fresh session` permissions.

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "",
  "authKey": "",
  "osInfo": {
    "platform": "",
    "variant": "",
    "variantVersion": ""
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": 0
    }
  ],
  "status": "Offline",
  "portForwardingConfigurations": [
    {
      "name": "",
      "port": 0,
      "login": "",
      "password": ""
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      ""
    ],
    "certificatePem": "",
    "userProvidedCertificatePem": "",
    "publicIp": ""
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "",
      "cpuModelName": ""
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": ""
    },
    "idConflictDetected": false
  }
}
```

*Required fields: `name`, `url`*

**Responses:**

**default**: Server record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "string",
  "osInfo": {
    "platform": "string",
    "variant": "string",
    "variantVersion": "string"
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": "0"
    }
  ],
  "status": "Offline",
  "storages": [
    {
      "parameters": {},
      "id": "{00000000-0000-0000-0000-000000000000}",
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Storage 1",
      "path": "string",
      "type": "string",
      "spaceLimitB": 0,
      "isUsedForWriting": false,
      "isBackup": false,
      "status": "Offline",
      "storageArchiveMode": "undefined"
    }
  ],
  "portForwardingConfigurations": [
    {
      "name": "string",
      "port": 0,
      "login": "string",
      "password": "string"
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      "string"
    ],
    "certificatePem": "string",
    "userProvidedCertificatePem": "string",
    "publicIp": "string"
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "string",
      "cpuModelName": "string"
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": "string"
    },
    "idConflictDetected": false
  }
}
```

---

### PATCH `/rest/v4/servers/{id}`

**Modify Server**

Modifies certain fields of the specified Server record stored in the Site.
Modification of some settings requires an `Administrator with a fresh session` permissions.

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "",
  "authKey": "",
  "osInfo": {
    "platform": "",
    "variant": "",
    "variantVersion": ""
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": 0
    }
  ],
  "status": "Offline",
  "portForwardingConfigurations": [
    {
      "name": "",
      "port": 0,
      "login": "",
      "password": ""
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      ""
    ],
    "certificatePem": "",
    "userProvidedCertificatePem": "",
    "publicIp": ""
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "",
      "cpuModelName": ""
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": ""
    },
    "idConflictDetected": false
  }
}
```

**Responses:**

**default**: Server record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Server 1",
  "url": "https://127.0.0.1:7001",
  "version": "string",
  "osInfo": {
    "platform": "string",
    "variant": "string",
    "variantVersion": "string"
  },
  "backupBitrateBytesPerSecond": [
    {
      "key": {
        "day": "monday",
        "hour": 0
      },
      "value": "0"
    }
  ],
  "status": "Offline",
  "storages": [
    {
      "parameters": {},
      "id": "{00000000-0000-0000-0000-000000000000}",
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "name": "Storage 1",
      "path": "string",
      "type": "string",
      "spaceLimitB": 0,
      "isUsedForWriting": false,
      "isBackup": false,
      "status": "Offline",
      "storageArchiveMode": "undefined"
    }
  ],
  "portForwardingConfigurations": [
    {
      "name": "string",
      "port": 0,
      "login": "string",
      "password": "string"
    }
  ],
  "flags": "none",
  "network": {
    "endpoints": [
      "string"
    ],
    "certificatePem": "string",
    "userProvidedCertificatePem": "string",
    "publicIp": "string"
  },
  "settings": {
    "locationId": 0,
    "isFailoverEnabled": false,
    "maxCameras": 0,
    "webCamerasDiscoveryEnabled": false
  },
  "runtimeInformation": {
    "hardwareInformation": {
      "physicalMemoryB": 0,
      "cpuArchitecture": "string",
      "cpuModelName": "string"
    },
    "timezone": {
      "timeZoneOffsetMs": 0,
      "timeZoneId": "string"
    },
    "idConflictDetected": false
  }
}
```

---

### DELETE `/rest/v4/servers/{id}`

**Delete Server**

Deletes the specified Server record from the Site.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{id}/info`

**Get Server info**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be "this" to refer to the current Server. |
| `onlyFreshInfo` | query | boolean |  | Flag to filter out Server Info from offline Servers. Use this flag     together with "_local" flag to control request propagation and response details. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get information about the Server.
```json
{
  "port": 0,
  "id": "{00000000-0000-0000-0000-000000000000}",
  "type": "string",
  "customization": "string",
  "brand": "string",
  "version": "string",
  "name": "string",
  "sslAllowed": false,
  "protoVersion": 0,
  "runtimeId": "{00000000-0000-0000-0000-000000000000}",
  "realm": "string",
  "cloudPortalUrl": "string",
  "cloudHost": "string",
  "hwPlatform": "unknown",
  "synchronizedTimeMs": 0,
  "cloudOwnerId": "{00000000-0000-0000-0000-000000000000}",
  "organizationId": "{00000000-0000-0000-0000-000000000000}",
  "saasState": "uninitialized",
  "remoteAddresses": [
    "string"
  ],
  "userProvidedCertificatePem": "string",
  "certificatePem": "string",
  "transactionLogTime": {
    "sequence": "string",
    "ticksMs": 0
  },
  "collectedByThisServer": false,
  "serverFlags": "none",
  "siteName": "string",
  "cloudSiteId": "string",
  "localSiteId": "{00000000-0000-0000-0000-000000000000}",
  "identityTimeMs": 0
}
```

---

### GET `/rest/v4/servers/*/info`

**Get all Servers' info**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `onlyFreshInfo` | query | boolean |  | Flag to filter out Server Info from offline Servers. Use this flag     together with "_local" flag to control request propagation and response details. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get information about all Servers in the Site.
```json
[
  {
    "port": 0,
    "id": "{00000000-0000-0000-0000-000000000000}",
    "type": "string",
    "customization": "string",
    "brand": "string",
    "version": "string",
    "name": "string",
    "sslAllowed": false,
    "protoVersion": 0,
    "runtimeId": "{00000000-0000-0000-0000-000000000000}",
    "realm": "string",
    "cloudPortalUrl": "string",
    "cloudHost": "string",
    "hwPlatform": "unknown",
    "synchronizedTimeMs": 0,
    "cloudOwnerId": "{00000000-0000-0000-0000-000000000000}",
    "organizationId": "{00000000-0000-0000-0000-000000000000}",
    "saasState": "uninitialized",
    "remoteAddresses": [
      "string"
    ],
    "userProvidedCertificatePem": "string",
    "certificatePem": "string",
    "transactionLogTime": {
      "sequence": "string",
      "ticksMs": 0
    },
    "collectedByThisServer": false,
    "serverFlags": "none",
    "siteName": "string",
    "cloudSiteId": "string",
    "localSiteId": "{00000000-0000-0000-0000-000000000000}",
    "identityTimeMs": 0
  }
]
```

---

### GET `/rest/v4/servers/{id}/runtimeInfo`

**Get Server runtime info**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get the runtime information about the Server.
```json
{
  "port": 0,
  "id": "{00000000-0000-0000-0000-000000000000}",
  "timeZoneOffsetMs": 0,
  "timeZoneId": "string",
  "osInfo": {
    "platform": "string",
    "variant": "string",
    "variantVersion": "string"
  },
  "osTimeMs": 0,
  "synchronizedTimeMs": 0,
  "runtimeData": {
    "version": 0,
    "peer": {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "persistentId": "{00000000-0000-0000-0000-000000000000}",
      "instanceId": "{00000000-0000-0000-0000-000000000000}",
      "peerType": "PT_NotDefined",
      "dataFormat": "JsonFormat"
    },
    "platform": "string",
    "box": "string",
    "brand": "string",
    "customization": "string",
    "publicIP": "string",
    "prematureLicenseExperationDate": "string",
    "videoWallInstanceGuid": "{00000000-0000-0000-0000-000000000000}",
    "videoWallControlSession": "{00000000-0000-0000-0000-000000000000}",
    "hardwareIds": [
      "string"
    ],
    "nx1mac": "string",
    "nx1serial": "string",
    "updateStarted": false,
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "flags": "MasterCloudSync",
    "activeAnalyticsEngines": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "prematureVideoWallLicenseExpirationDate": "string",
    "parentServerId": "{00000000-0000-0000-0000-000000000000}",
    "tierGracePeriodExpirationDateMs": 0,
    "activeIntegrations": [
      "{00000000-0000-0000-0000-000000000000}"
    ]
  },
  "storageProtocols": [
    "string"
  ],
  "hardware": {
    "boardSerial": "string",
    "boardVendor": "string",
    "productUuid": "{00000000-0000-0000-0000-000000000000}",
    "productSerial": "string",
    "biosVendor": "string",
    "memoryPartNumber": "string",
    "memorySerialNumber": "string",
    "networkInterfaceControllers": [
      {
        "subsystem": "string",
        "mac": "string"
      }
    ],
    "mac": "string"
  }
}
```

---

### PATCH `/rest/v4/servers/{id}/runtimeInfo`

**Modify Server port**

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "port": 0
}
```

**Responses:**

**default**: Runtime information about the Server.
```json
{
  "port": 0,
  "id": "{00000000-0000-0000-0000-000000000000}",
  "timeZoneOffsetMs": 0,
  "timeZoneId": "string",
  "osInfo": {
    "platform": "string",
    "variant": "string",
    "variantVersion": "string"
  },
  "osTimeMs": 0,
  "synchronizedTimeMs": 0,
  "runtimeData": {
    "version": 0,
    "peer": {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "persistentId": "{00000000-0000-0000-0000-000000000000}",
      "instanceId": "{00000000-0000-0000-0000-000000000000}",
      "peerType": "PT_NotDefined",
      "dataFormat": "JsonFormat"
    },
    "platform": "string",
    "box": "string",
    "brand": "string",
    "customization": "string",
    "publicIP": "string",
    "prematureLicenseExperationDate": "string",
    "videoWallInstanceGuid": "{00000000-0000-0000-0000-000000000000}",
    "videoWallControlSession": "{00000000-0000-0000-0000-000000000000}",
    "hardwareIds": [
      "string"
    ],
    "nx1mac": "string",
    "nx1serial": "string",
    "updateStarted": false,
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "flags": "MasterCloudSync",
    "activeAnalyticsEngines": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "prematureVideoWallLicenseExpirationDate": "string",
    "parentServerId": "{00000000-0000-0000-0000-000000000000}",
    "tierGracePeriodExpirationDateMs": 0,
    "activeIntegrations": [
      "{00000000-0000-0000-0000-000000000000}"
    ]
  },
  "storageProtocols": [
    "string"
  ],
  "hardware": {
    "boardSerial": "string",
    "boardVendor": "string",
    "productUuid": "{00000000-0000-0000-0000-000000000000}",
    "productSerial": "string",
    "biosVendor": "string",
    "memoryPartNumber": "string",
    "memorySerialNumber": "string",
    "networkInterfaceControllers": [
      {
        "subsystem": "string",
        "mac": "string"
      }
    ],
    "mac": "string"
  }
}
```

---

### GET `/rest/v4/servers/*/runtimeInfo`

**Get all Servers' runtime info**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get runtime information about all Servers
in the Site.
```json
[
  {
    "port": 0,
    "id": "{00000000-0000-0000-0000-000000000000}",
    "timeZoneOffsetMs": 0,
    "timeZoneId": "string",
    "osInfo": {
      "platform": "string",
      "variant": "string",
      "variantVersion": "string"
    },
    "osTimeMs": 0,
    "synchronizedTimeMs": 0,
    "runtimeData": {
      "version": 0,
      "peer": {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "persistentId": "{00000000-0000-0000-0000-000000000000}",
        "instanceId": "{00000000-0000-0000-0000-000000000000}",
        "peerType": "PT_NotDefined",
        "dataFormat": "JsonFormat"
      },
      "platform": "string",
      "box": "string",
      "brand": "string",
      "customization": "string",
      "publicIP": "string",
      "prematureLicenseExperationDate": "string",
      "videoWallInstanceGuid": "{00000000-0000-0000-0000-000000000000}",
      "videoWallControlSession": "{00000000-0000-0000-0000-000000000000}",
      "hardwareIds": [
        "string"
      ],
      "nx1mac": "string",
      "nx1serial": "string",
      "updateStarted": false,
      "userId": "{00000000-0000-0000-0000-000000000000}",
      "flags": "MasterCloudSync",
      "activeAnalyticsEngines": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "prematureVideoWallLicenseExpirationDate": "string",
      "parentServerId": "{00000000-0000-0000-0000-000000000000}",
      "tierGracePeriodExpirationDateMs": 0,
      "activeIntegrations": [
        "{00000000-0000-0000-0000-000000000000}"
      ]
    },
    "storageProtocols": [
      "string"
    ],
    "hardware": {
      "boardSerial": "string",
      "boardVendor": "string",
      "productUuid": "{00000000-0000-0000-0000-000000000000}",
      "productSerial": "string",
      "biosVendor": "string",
      "memoryPartNumber": "string",
      "memorySerialNumber": "string",
      "networkInterfaceControllers": [
        {}
      ],
      "mac": "string"
    }
  }
]
```

---

### GET `/rest/v4/servers/{id}/logSettings`

**Get Server log settings**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Server log settings.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "directory": "string",
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  }
}
```

---

### PUT `/rest/v4/servers/{id}/logSettings`

**Set Server log settings**

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  }
}
```

**Responses:**

**default**: Server log settings.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "directory": "string",
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  }
}
```

---

### PATCH `/rest/v4/servers/{id}/logSettings`

**Modify Server log settings**

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  }
}
```

**Responses:**

**default**: Server log settings.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "directory": "string",
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "string",
    "predefinedFilters": [
      "string"
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "string",
        "level": "undefined"
      }
    ]
  }
}
```

---

### GET `/rest/v4/servers/*/logSettings`

**Get all Servers' log settings**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Log settings for every Server in the Site.
```json
{}
```

---

### PUT `/rest/v4/servers/*/logSettings`

**Set all Servers' log settings**

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  }
}
```

**Responses:**

**default**: Log Settings for every Server in the Site.
```json
{}
```

---

### PATCH `/rest/v4/servers/*/logSettings`

**Modify Servers' log settings**

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "directory": "",
  "maxVolumeSizeB": 0,
  "maxFileSizeB": 0,
  "maxFileTimePeriodS": 0,
  "archivingEnabled": false,
  "mainLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "httpLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  },
  "systemLog": {
    "fileName": "",
    "predefinedFilters": [
      ""
    ],
    "primaryLevel": "undefined",
    "customFilters": [
      {
        "filter": "",
        "level": "undefined"
      }
    ]
  }
}
```

**Responses:**

**default**: Log settings for every Server in the Site.
```json
{}
```

---

### GET `/rest/v4/servers/{id}/logArchive`

**Get log archive**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `lastN` | query | integer |  | N most recent rotated log files. |
| `names` | query | array |  | Logs included in the archive.  Possible values are: - `main` - `http` - `system` - `update` |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Archive with the log files.

---

### GET `/rest/v4/servers/{id}/staticWebContent`

**Get static web content info**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Information about the static web content.
```json
{
  "source": "string",
  "sha256": "string",
  "timestampMs": 0,
  "update": {
    "source": "builtin",
    "expectedSha256": "string",
    "percentage": 0,
    "status": "ok",
    "httpCode": 0
  }
}
```

---

### PUT `/rest/v4/servers/{id}/staticWebContent`

**Download static web content**

Starts a download from a specified URL, the download status and progress can be
monitored with `GET /rest/v4/servers/{id}/staticWebContent` request. A successfully
downloaded archive replaces the static web content. Another `PUT` request cancels
the current download and starts a new one.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "source": "",
  "sha256": "",
  "timestampMs": 0,
  "update": {
    "source": "builtin",
    "expectedSha256": "",
    "percentage": 0,
    "status": "ok",
    "httpCode": 0
  }
}
```

**Responses:**

**default**: Information about the static web content.
```json
{
  "source": "string",
  "sha256": "string",
  "timestampMs": 0,
  "update": {
    "source": "builtin",
    "expectedSha256": "string",
    "percentage": 0,
    "status": "ok",
    "httpCode": 0
  }
}
```

---

### DELETE `/rest/v4/servers/{id}/staticWebContent`

**Reset static web content**

Resets the static web content to the one that comes with the installation. This request
cancels any background download.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### PUT `/rest/v4/servers/{id}/staticWebContent/upload`

**Upload static web content**

Uploads the static web content directly as a binary archive. This request cancels any
background download and forcefully sets the uploaded content as the static web content.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/octet-stream`

```json
"string"
```

**Responses:**

**default**: Information about the static web content.
```json
{
  "source": "string",
  "sha256": "string",
  "timestampMs": 0,
  "update": {
    "source": "builtin",
    "expectedSha256": "string",
    "percentage": 0,
    "status": "ok",
    "httpCode": 0
  }
}
```

---

### POST `/rest/v4/servers/{id}/detach`

**Detach Server**

Detaches the Server specified by {id} from the Site. This means that:
- The Server local Site id will be reset.
- The Server admin password will be set to default.
- All Cloud Users will be deleted from the Server DB (if any).
- The Server will be unbound from the Cloud (if it was bound).
- The Server will be disconnected from all the other Servers in the Site.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from the "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/servers/{id}/reset`

**Reset Server**

Resets the Server specified by {id} to the initial state, i.e. <b>deletes the Server
database</b>. The Server will restart after executing this command.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/servers/{id}/restart`

**Restart Server**

Restarts the Server specified by {id}.

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{id}/p2pStats`

**Get Server P2P stats**

<p><b>Proprietary.</b></p>

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: P2P Stats.
```json
{
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "data": {
    "totalBytesSent": "string",
    "totalDbData": "string"
  },
  "connections": {
    "connections": [
      {
        "remotePeerId": "{00000000-0000-0000-0000-000000000000}",
        "remotePeerDbId": "{00000000-0000-0000-0000-000000000000}",
        "url": "string",
        "state": "string",
        "previousState": "string",
        "isIncoming": false,
        "isStarted": false,
        "gotPeerInfo": false,
        "peerType": "PT_NotDefined",
        "subscribedTo": [],
        "subscribedFrom": []
      }
    ],
    "idData": {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "persistentId": "{00000000-0000-0000-0000-000000000000}"
    }
  }
}
```

---

### GET `/rest/v4/servers/*/p2pStats`

**Get P2P stats of all Servers**

<p><b>Proprietary.</b></p>Retrieves P2P stats for all Servers

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of P2P stats.
```json
[
  {
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "data": {
      "totalBytesSent": "string",
      "totalDbData": "string"
    },
    "connections": {
      "connections": [
        {}
      ],
      "idData": {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "persistentId": "{00000000-0000-0000-0000-000000000000}"
      }
    }
  }
]
```

---

### GET `/rest/v4/servers/{id}/iniConfig`

**Get IniConfig info**

<p><b>Proprietary.</b></p>Intended for debugging and experimenting. Retrieves the current state of the IniConfig
mechanism, including the directory used for .ini files. Note that this directory is also
used for other mechanisms like Output Redirector and log configuration snippets.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "iniConfigDir": "string"
}
```

---

### GET `/rest/v4/servers/*/iniConfig`

**Get Servers' IniConfig info**

<p><b>Proprietary.</b></p>

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "iniConfigDir": "string"
  }
]
```

---

### GET `/rest/v4/servers/{id}/settings`

**Server settings information**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server, or be "*" to involve all Servers. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "settingsDescription": {},
  "type": "fileSystem",
  "location": "string"
}
```

---

### GET `/rest/v4/servers/*/settings`

**Servers config information**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "settingsDescription": {},
    "type": "fileSystem",
    "location": "string"
  }
]
```

---

### GET `/rest/v4/servers/{id}/timeZones`

**Get Time Zones**

Retrieves the complete list of time zones supported by the Server machine.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of objects representing the time zones.
```json
[
  {
    "id": "string",
    "offsetFromUtcS": 0,
    "displayName": "string",
    "hasDaylightTime": false,
    "isDaylightTime": false,
    "comment": "string"
  }
]
```

---

### GET `/rest/v4/servers/{id}/scripts`

**Get scripts**

Retrieves the complete list of scripts available to execute by the Server machine.

> **Permissions:** Power user.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server, or be "*" to involve all Servers. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of scripts available on Server.
```json
[
  "string"
]
```

---

### POST `/rest/v4/servers/{id}/scripts/{name}/run`

**Execute script**

Execute a script on the Server. Use `/rest/v4/servers/{id}/scripts` to get the available
scripts.

> **Permissions:** Power user.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be "this" to refer to the current Server. |
| `name` | path | string | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "args": [
    ""
  ],
  "waitForFinished": false
}
```

*Required fields: `args`, `waitForFinished`*

**Responses:**

**default**: Result of executed process
```json
{
  "returnCode": 0
}
```

---

### POST `/rest/v4/servers/{serverId}/testEmail`

**Test Email Settings**

Performs test connection to the SMTP service described in the parameter by the built-in
SMTP client. If parameter is omitted, the same set of the data fields will be retrieved from
the Site Settings. Thus, this method may be used both for checking potential and currently
in use SMTP services.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be "this" to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "settings": {
    "email": "",
    "server": "",
    "user": "",
    "password": "",
    "signature": "",
    "supportAddress": "",
    "connectionType": "insecure",
    "port": 0,
    "timeoutS": 0,
    "smtpEhloName": "",
    "useCloudServiceToSendEmail": false
  }
}
```

**Responses:**

**default**: Result of settings request.
```json
{
  "smtpReplyCode": 0
}
```

---

### POST `/rest/v4/servers/{serverId}/pingDevices`

**Ping Devices**

Queries the given list of device UUIDs over the network and returns the list of of those
UUIDs that are available

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be "this" to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "deviceIds": [
    ""
  ]
}
```

*Required fields: `deviceIds`*

**Responses:**

**default**: List of connected devices.
```json
[
  {
    "parameters": {},
    "id": "{00000000-0000-0000-0000-000000000000}",
    "physicalId": "92-61-00-00-00-9F",
    "url": "192.168.0.1",
    "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
    "name": "Device 1",
    "mac": "string",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "isManuallyAdded": false,
    "vendor": "string",
    "model": "string",
    "group": {
      "id": "string",
      "name": "Group 1"
    },
    "credentials": {
      "user": "admin",
      "password": "password123"
    }
  }
]
```

---

### GET `/rest/v4/servers/{id}/nvrNetwork`

**NVR Network**

<p><b>Proprietary.</b></p>Retrieves the NVR network state. Works only on a VMS Server installed on an NVR device.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Network Block Result.
```json
{
  "portStates": [
    {
      "portNumber": 6000,
      "poweringMode": "off",
      "macAddress": "string",
      "devicePowerConsumptionWatts": 0,
      "devicePowerConsumptionLimitWatts": 0,
      "linkSpeedMbps": 0,
      "poweringStatus": "disconnected"
    }
  ],
  "upperPowerLimitWatts": 0,
  "lowerPowerLimitWatts": 0,
  "isInPoeOverBudgetMode": false
}
```

---

### PUT `/rest/v4/servers/{id}/nvrNetwork`

**NVR Network**

<p><b>Proprietary.</b></p>Configures the NVR network state. Works only on a VMS Server installed on an NVR device.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be "this" to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "portPowerList": [
    {
      "portNumber": 6000,
      "poweringMode": "off"
    }
  ]
}
```

*Required fields: `portPowerList`*

**Responses:**

**default**: Network Block Result.
```json
{
  "portStates": [
    {
      "portNumber": 6000,
      "poweringMode": "off",
      "macAddress": "string",
      "devicePowerConsumptionWatts": 0,
      "devicePowerConsumptionLimitWatts": 0,
      "linkSpeedMbps": 0,
      "poweringStatus": "disconnected"
    }
  ],
  "upperPowerLimitWatts": 0,
  "lowerPowerLimitWatts": 0,
  "isInPoeOverBudgetMode": false
}
```

---

### GET `/rest/v4/servers/{id}/overlappedIds/{groupId}`

**Overlapped Ids**

<p><b>Proprietary.</b></p>Retrieves the Overlapped Id in use on the NVR. Works only on a VMS Server connected to an
NVR which supportes the Overlapped Id feature.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ |  |
| `groupId` | path | string | ✓ | Group id of the NVR. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Overlapped Id Settings.
```json
{
  "currentOverlappedId": 0,
  "availableOverlappedIds": []
}
```

---

### PUT `/rest/v4/servers/{id}/overlappedIds/{groupId}`

**Overlapped Ids**

<p><b>Proprietary.</b></p>Sets the Overlapped Id to use on the NVR. Works only on a VMS Server connected to an
NVR which supportes the Overlapped Id feature.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ |  |
| `groupId` | path | string | ✓ | Group id of the NVR. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "overlappedId": 0
}
```

**Responses:**

**default**: Overlapped Id Settings.
```json
{
  "currentOverlappedId": 0,
  "availableOverlappedIds": []
}
```

---

### GET `/rest/v4/servers/{serverId}/audit`

**Get Audit log**

> **Permissions:** Administrator.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server, or be `*` to involve all Servers. |
| `from` | query | string |  | Start time of a time interval, as a string containing time in milliseconds since epoch, or a local time formatted like <code>"<i>YYYY</i>-<i>MM</i>-<i>DD</i>T<i>HH</i>:<i>mm</i>:<i>ss</i>.<i>zzz</i>"</code> - the format is auto-detected. |
| `to` | query | string |  | End time of a time interval, as a string containing time in milliseconds since epoch, or a local time formatted like <code>"<i>YYYY</i>-<i>MM</i>-<i>DD</i>T<i>HH</i>:<i>mm</i>:<i>ss</i>.<i>zzz</i>"</code> - the format is auto-detected. |
| `sessionId` | query | string(uuid) |  | User session id to filter output. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "eventType": "notDefined",
    "createdTimeS": 0,
    "authSession": {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "userName": "string",
      "userHost": "string",
      "userAgent": "string",
      "isAutoGenerated": false
    },
    "details": {
      "description": "string"
    }
  }
]
```

---

### GET `/rest/v4/servers/{id}/analyticsTaxonomyDescriptors`

**Get Server Taxonomy data**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get Taxonomy descriptors for the Servers.
```json
{
  "pluginDescriptors": {},
  "engineDescriptors": {},
  "groupDescriptors": {},
  "eventTypeDescriptors": {},
  "objectTypeDescriptors": {},
  "enumTypeDescriptors": {},
  "colorTypeDescriptors": {},
  "attributeListDescriptors": {}
}
```

---

### GET `/rest/v4/servers/*/analyticsTaxonomyDescriptors`

**Get Servers' Taxonomy data**

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | query | array |  | Server id(s). Can be obtained from "id" field via `GET /rest/v4/servers`. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Get Taxonomy descriptors for all Servers.
```json
{}
```

---

## Server Data

### GET `/rest/v4/servers/{serverId}/storages`

**Get Storages**

Retrieves all Storage records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server, or be omitted by using '*' placeholder to use all Servers. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Storage records.
```json
[
  {
    "parameters": {},
    "id": "{00000000-0000-0000-0000-000000000000}",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "name": "Storage 1",
    "path": "string",
    "type": "string",
    "spaceLimitB": 0,
    "isUsedForWriting": false,
    "isBackup": false,
    "status": "Offline",
    "storageArchiveMode": "undefined"
  }
]
```

---

### POST `/rest/v4/servers/{serverId}/storages`

**Create Storage**

Creates a record in the Site for the new Storage.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "Storage 1",
  "path": "",
  "type": "",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

*Required fields: `name`, `path`*

**Responses:**

**default**: Storage record that was created.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Storage 1",
  "path": "string",
  "type": "string",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

---

### GET `/rest/v4/servers/{serverId}/storages/{id}`

**Get Storage**

Retrieves the specified Storage record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server, or be omitted by using '*' placeholder. |
| `id` | path | string(uuid) | ✓ | Storage id (can be obtained from "id" field via `GET /rest/v4/servers/{serverId}/storages`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Storage 1",
  "path": "string",
  "type": "string",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

---

### PUT `/rest/v4/servers/{serverId}/storages/{id}`

**Replace Storage**

Replaces all fields of the specified Storage record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Storage id (can be obtained from "id" field via `GET /rest/v4/servers/{serverId}/storages`). |
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "Storage 1",
  "path": "",
  "type": "",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

*Required fields: `name`, `path`*

**Responses:**

**default**: Storage record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Storage 1",
  "path": "string",
  "type": "string",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

---

### PATCH `/rest/v4/servers/{serverId}/storages/{id}`

**Modify Storage**

Modifies certain fields of the specified Storage record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Storage id (can be obtained from "id" field via `GET /rest/v4/servers/{serverId}/storages`). |
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "Storage 1",
  "path": "",
  "type": "",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

**Responses:**

**default**: Storage record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Storage 1",
  "path": "string",
  "type": "string",
  "spaceLimitB": 0,
  "isUsedForWriting": false,
  "isBackup": false,
  "status": "Offline",
  "storageArchiveMode": "undefined"
}
```

---

### DELETE `/rest/v4/servers/{serverId}/storages/{id}`

**Delete Storage**

Deletes the specified Storage record from the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `id` | path | string(uuid) | ✓ | Storage id (can be obtained from "id" field via `GET /rest/v4/servers/{serverId}/storages`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{id}/backupSettings`

**Get Server Backup settings**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Server Backup settings.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "quality": "CameraBackupBoth",
  "backupNewCameras": false
}
```

---

### POST `/rest/v4/servers/{id}/backupSettings`

**Set Server Backup settings**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "quality": "CameraBackupBoth",
  "backupNewCameras": false
}
```

*Required fields: `quality`, `backupNewCameras`*

**Responses:**

**default**: Backup settings.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "quality": "CameraBackupBoth",
  "backupNewCameras": false
}
```

---

### GET `/rest/v4/servers/*/backupSettings`

**Get Servers' Backup settings**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Backup settings of all Servers.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "quality": "CameraBackupBoth",
    "backupNewCameras": false
  }
]
```

---

### GET `/rest/v4/servers/{serverId}/backupPositions`

**Get Server Backup Positions**

Retrieves Backup Positions for all Devices from the Server specified by `serverId`.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of actual Backup Positions for all Devices on the
Server.
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "media": {
      "positionLowMs": 0,
      "positionHighMs": 0,
      "bookmarkHighStartPositionMs": 0,
      "bookmarkLowStartPositionMs": 0
    },
    "metadata": {
      "bookmarkPositionMs": 0,
      "bookmarkRecordId": "string",
      "motionPositionMs": 0,
      "analyticsPositionMs": 0
    },
    "toBackupLowMs": 0,
    "toBackupHighMs": 0
  }
]
```

---

### PUT `/rest/v4/servers/{serverId}/backupPositions`

**Set Devices' Backup Positions**

Sets the Backup Position for all Devices for the Server specified by `serverId`. Note that
"positionLowMs" and "positionHighMs" can not be moved to the past, only to the future.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "media": {
    "positionLowMs": 0,
    "positionHighMs": 0,
    "bookmarkHighStartPositionMs": 0,
    "bookmarkLowStartPositionMs": 0
  },
  "metadata": {
    "bookmarkPositionMs": 0,
    "bookmarkRecordId": "",
    "motionPositionMs": 0,
    "analyticsPositionMs": 0
  }
}
```

*Required fields: `media`, `metadata`*

**Responses:**

**default**: Backup Positions.
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "media": {
      "positionLowMs": 0,
      "positionHighMs": 0,
      "bookmarkHighStartPositionMs": 0,
      "bookmarkLowStartPositionMs": 0
    },
    "metadata": {
      "bookmarkPositionMs": 0,
      "bookmarkRecordId": "string",
      "motionPositionMs": 0,
      "analyticsPositionMs": 0
    }
  }
]
```

---

### GET `/rest/v4/servers/{serverId}/backupPositions/{deviceId}`

**Get Device Backup Position**

Retrieves the Backup Position for the Device specified by `deviceId` from the Server
specified by `serverId`. In the case the backup cannot be continued because of a critical
storage issues, "positionLowMs", "positionHighMs" and "bookmarkStartPositionMs" will equal
`-2`.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Backup Position for the given Device.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "media": {
    "positionLowMs": 0,
    "positionHighMs": 0,
    "bookmarkHighStartPositionMs": 0,
    "bookmarkLowStartPositionMs": 0
  },
  "metadata": {
    "bookmarkPositionMs": 0,
    "bookmarkRecordId": "string",
    "motionPositionMs": 0,
    "analyticsPositionMs": 0
  },
  "toBackupLowMs": 0,
  "toBackupHighMs": 0
}
```

---

### PUT `/rest/v4/servers/{serverId}/backupPositions/{deviceId}`

**Set Device Backup Position**

Sets the Backup Position for the Device specified by `deviceId` and the Server specified by
`serverId`. Note that "positionLowMs" and "positionHighMs" cannot be moved to the past, only
to the future.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "media": {
    "positionLowMs": 0,
    "positionHighMs": 0,
    "bookmarkHighStartPositionMs": 0,
    "bookmarkLowStartPositionMs": 0
  },
  "metadata": {
    "bookmarkPositionMs": 0,
    "bookmarkRecordId": "",
    "motionPositionMs": 0,
    "analyticsPositionMs": 0
  }
}
```

*Required fields: `media`, `metadata`*

**Responses:**

**default**: Backup Position.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "media": {
    "positionLowMs": 0,
    "positionHighMs": 0,
    "bookmarkHighStartPositionMs": 0,
    "bookmarkLowStartPositionMs": 0
  },
  "metadata": {
    "bookmarkPositionMs": 0,
    "bookmarkRecordId": "string",
    "motionPositionMs": 0,
    "analyticsPositionMs": 0
  }
}
```

---

### POST `/rest/v4/servers/{serverId}/backupPositions/{deviceId}/reset`

**Reset Device Backup Position**

Resets the Backup Position for the Device specified by `deviceId` on the Server specified
by `serverId`. Note that `deviceId` might be equal to "*", In this case Backup Position
is reset for all devices on this server.
Backup process will start from scratch. Note that previously
backed up data will not be deleted. Only data present in the main archive but missing
in the backup will be processed.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{}
```

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{serverId}/deploymentCode`

**Server Deployment code**

Get Server Deployment Code.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `version` | query | `v21x21` \| `v25x25` \| `v29x29` \| `v33x33` \| `v37x37` \| `v41x41` \| `v45x45` \| `v49x49` \| `v53x53` \| `v57x57` \| `v61x61` \| `v65x65` \| `v69x69` \| `v73x73` \| `v77x77` \| `v81x81` \| `v85x85` \| `v89x89` \| `v93x93` \| `v97x97` \| `v101x101` \| `v105x105` \| `v109x109` \| `v113x113` \| `v117x117` \| `v121x121` \| `v125x125` \| `v129x129` \| `v133x133` \| `v137x137` \| `v141x141` \| `v145x145` \| `v149x149` \| `v153x153` \| `v157x157` \| `v161x161` \| `v165x165` \| `v169x169` \| `v173x173` \| `v177x177` |  | QR Code version. Can be omitted, in this case the smallest possible version will be chosen which can fit given text and correction level. |
| `correctionLevel` | query | `low` \| `medium` \| `mediumHigh` \| `high` | ✓ | QR Code correction level. |
| `imageType` | query | `bmp` \| `png` | ✓ | QR Code image type. |
| `pixelSize` | query | integer | ✓ | QR Code image pixel size. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Deployment Code data
```json
{
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "code": "string",
  "url": "string",
  "imageBase64": "string"
}
```

---

### GET `/rest/v4/servers/*/deploymentCode`

**Servers Deployment codes**

Get all Servers Deployment Codes.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `version` | query | `v21x21` \| `v25x25` \| `v29x29` \| `v33x33` \| `v37x37` \| `v41x41` \| `v45x45` \| `v49x49` \| `v53x53` \| `v57x57` \| `v61x61` \| `v65x65` \| `v69x69` \| `v73x73` \| `v77x77` \| `v81x81` \| `v85x85` \| `v89x89` \| `v93x93` \| `v97x97` \| `v101x101` \| `v105x105` \| `v109x109` \| `v113x113` \| `v117x117` \| `v121x121` \| `v125x125` \| `v129x129` \| `v133x133` \| `v137x137` \| `v141x141` \| `v145x145` \| `v149x149` \| `v153x153` \| `v157x157` \| `v161x161` \| `v165x165` \| `v169x169` \| `v173x173` \| `v177x177` |  | QR Code version. Can be omitted, in this case the smallest possible version will be chosen which can fit given text and correction level. |
| `correctionLevel` | query | `low` \| `medium` \| `mediumHigh` \| `high` | ✓ | QR Code correction level. |
| `imageType` | query | `bmp` \| `png` | ✓ | QR Code image type. |
| `pixelSize` | query | integer | ✓ | QR Code image pixel size. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Deployment code data per Server.
```json
[
  {
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "code": "string",
    "url": "string",
    "imageBase64": "string"
  }
]
```

---

### GET `/rest/v4/servers/{serverId}/qrcode/image`

**Get Server QR code image**

Get QR Code image from the Server specified by {serverId}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `version` | query | `v21x21` \| `v25x25` \| `v29x29` \| `v33x33` \| `v37x37` \| `v41x41` \| `v45x45` \| `v49x49` \| `v53x53` \| `v57x57` \| `v61x61` \| `v65x65` \| `v69x69` \| `v73x73` \| `v77x77` \| `v81x81` \| `v85x85` \| `v89x89` \| `v93x93` \| `v97x97` \| `v101x101` \| `v105x105` \| `v109x109` \| `v113x113` \| `v117x117` \| `v121x121` \| `v125x125` \| `v129x129` \| `v133x133` \| `v137x137` \| `v141x141` \| `v145x145` \| `v149x149` \| `v153x153` \| `v157x157` \| `v161x161` \| `v165x165` \| `v169x169` \| `v173x173` \| `v177x177` |  | QR Code version. Can be omitted, in this case the smallest possible version will be chosen which can fit given text and correction level. |
| `correctionLevel` | query | `low` \| `medium` \| `mediumHigh` \| `high` | ✓ | QR Code correction level. |
| `imageType` | query | `bmp` \| `png` | ✓ | QR Code image type. |
| `pixelSize` | query | integer | ✓ | QR Code image pixel size. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{serverId}/remoteArchive/{deviceId}/sync`

**Get Remote Archive status**

Retrieves the Remote Archive synchronization status for the Device specified by {deviceId}
from the Server specified by {serverId}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Remote Archive Synchronization status.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "code": "enabled",
  "importedPositionMs": 0,
  "durationToImportMs": 0
}
```

---

### GET `/rest/v4/servers/{serverId}/remoteArchive/*/sync`

**Get Remote Archive statuses**

Retrieves the Remote Archive synchronization status list for Devices from the Server
specified by {serverId}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Remote Archive Synchronization Statuses
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "code": "enabled",
    "importedPositionMs": 0,
    "durationToImportMs": 0
  }
]
```

---

### POST `/rest/v4/servers/{id}/dbBackups`

**Back up Site DB**

Creates a Site database Backup on the Server specified by {id}.

> **Permissions:** Administrator.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "reason": "manual"
}
```

**Responses:**

**default**: Location on the Server of the created DB backup file.
```json
{
  "path": "string"
}
```

---

### GET `/rest/v4/servers/{id}/dbBackups`

**List Site DB Backups**

> **Permissions:** Administrator.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of the DB backup file locations on the Server.
```json
[
  {
    "path": "string"
  }
]
```

---

### GET `/rest/v4/servers/{id}/dbBackups/{filename}/download`

**Download Site DB Backup**

Downloads a Site database Backup from the Server specified by {id}.

> **Permissions:** Administrator with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `filename` | path | string | ✓ | Filename of the backup file. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{id}/recordingStatistics`

**Get Server recording stats**

Retrieves the Server recording statistics.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `bitrateAnalyzePeriodMs` | query | string |  |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Recording statistics for the Server.
```json
[
  {
    "deviceId": "string",
    "recordedBytes": 0,
    "recordedS": 0,
    "archiveDurationS": 0,
    "averageBitrate": 0,
    "averageDensity": 0
  }
]
```

---

### GET `/rest/v4/servers/*/recordingStatistics`

**Get Servers' recording stats**

Retrieves the recording statistics for all Servers.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `bitrateAnalyzePeriodMs` | query | string |  |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Recording statistics for all Servers.
```json
{}
```

---

### GET `/rest/v4/servers/{id}/storageForecast`

**Get Server Storage forecast**

Retrieves the Server Storage forecast.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `bitrateAnalyzePeriodMs` | query | string |  |  |
| `additionalSpaceB` | query | integer |  |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage forecast for the Server.
```json
[
  {
    "deviceId": "string",
    "recordedS": 0,
    "recordedB": 0,
    "forecastB": 0,
    "forecastS": 0,
    "averageBps": 0,
    "averageDensityBps": 0
  }
]
```

---

### GET `/rest/v4/servers/*/storageForecast`

**Get Servers' Storage forecasts**

Retrieves all Storage forecasts for all Servers.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `bitrateAnalyzePeriodMs` | query | string |  |  |
| `additionalSpaceB` | query | integer |  |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage forecast for all Servers.
```json
{}
```

---

### POST `/rest/v4/servers/{id}/storages/*/purge`

**Start Storage purge**

Starts Storage purge for the Server specified by {id}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "pool": "main"
}
```

*Required fields: `pool`*

**Responses:**

**default**: Storage purge status.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "state": "idle",
  "progress": 0
}
```

---

### GET `/rest/v4/servers/{id}/storages/*/purge`

**Get Storage purge status**

Retrieves the Storage purge status for the Server specified by {id}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `pool` | query | `main` \| `backup` | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage purge status.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "state": "idle",
  "progress": 0
}
```

---

### GET `/rest/v4/servers/*/storages/*/purge`

**Get all Storage purge statuses**

Retrieves the Storage purge statuses for all Servers.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `pool` | query | `main` \| `backup` | ✓ |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage purge status list.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "state": "idle",
    "progress": 0
  }
]
```

---

### GET `/rest/v4/servers/{serverId}/storages/{id}/status`

**Get Storage status**

Retrieves the existing Storage status information object specified by {id} for the Server
specified by {serverId}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `id` | path | string(uuid) | ✓ | Storage id (can be obtained from "id" field via `GET /rest/v4/servers/{serverId}/storages`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage status information object.
```json
{
  "url": "string",
  "storageId": "{00000000-0000-0000-0000-000000000000}",
  "totalSpace": "string",
  "freeSpace": "string",
  "reservedSpace": "string",
  "isExternal": false,
  "isWritable": false,
  "isUsedForWriting": false,
  "isBackup": false,
  "isOnline": false,
  "storageType": "string",
  "runtimeFlags": "none",
  "persistentFlags": "none",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "name": "string"
}
```

---

### GET `/rest/v4/servers/{serverId}/storages/*/status`

**Get all Storages' statuses**

Retrieves the existing Storage status information objects for the Server specified by
{serverId}.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server, or be "*" to involve all Servers. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage status information objects.
```json
[
  {
    "url": "string",
    "storageId": "{00000000-0000-0000-0000-000000000000}",
    "totalSpace": "string",
    "freeSpace": "string",
    "reservedSpace": "string",
    "isExternal": false,
    "isWritable": false,
    "isUsedForWriting": false,
    "isBackup": false,
    "isOnline": false,
    "storageType": "string",
    "runtimeFlags": "none",
    "persistentFlags": "none",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "name": "string"
  }
]
```

---

### GET `/rest/v4/servers/{serverId}/storages/*/check`

**Check Storage path**

Check whether the specified location could be used as a Storage path for the Server
specified by {serverId} and report the location details.
If the location is already used as the Server Storage then `storageId` is expected in response.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `path` | query | string | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage status information object.
```json
{
  "url": "string",
  "storageId": "{00000000-0000-0000-0000-000000000000}",
  "totalSpace": "string",
  "freeSpace": "string",
  "reservedSpace": "string",
  "isExternal": false,
  "isWritable": false,
  "isUsedForWriting": false,
  "isBackup": false,
  "isOnline": false,
  "storageType": "string",
  "runtimeFlags": "none",
  "persistentFlags": "none",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "name": "string"
}
```

---

### GET `/rest/v4/servers/{id}/rebuildArchive`

**Get Archives rebuild status**

Retrieves the status of rebuilding of the Server "main" and "backup" Archives.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Archive rebuilding process information
object per Archive location.
```json
{}
```

---

### POST `/rest/v4/servers/{id}/rebuildArchive`

**Start rebuilding Archives**

Starts the Server "main" and "backup" Archive rebuilding.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be "this" to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "location": "both",
  "startPointMs": 0
}
```

**Responses:**

**default**: Archive rebuilding process information object
per Archive location.
```json
{}
```

---

### DELETE `/rest/v4/servers/{id}/rebuildArchive`

**Stop rebuilding Archives**

Stops rebuilding the Server Archive.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/*/rebuildArchive`

**Get Archives rebuild statuses**

Retrieves the status of the "main" and "backup" Archive rebuilding from all Servers.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage rebuild process
information object per Server.
```json
{}
```

---

### DELETE `/rest/v4/servers/*/rebuildArchive`

**Stop rebuilding all Archives**

Stops rebuilding the Archives for all Servers.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/{id}/rebuildArchive/{location}`

**Get Archive rebuild status**

Retrieves the status of the Server "main" or "backup" Archive rebuilding.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be `this` to refer to the current Server. |
| `location` | path | `main` \| `backup` | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Archive rebuilding process information object
per Archive location.
```json
{}
```

---

### POST `/rest/v4/servers/{id}/rebuildArchive/{location}`

**Start rebuilding Archive**

Starts rebuilding the Server "main" or "backup" Archive.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers` or be "this" to refer to the current Server. |
| `location` | path | `both` \| `main` \| `backup` | ✓ | Storage location. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "startPointMs": 0
}
```

**Responses:**

**default**: Archive rebuilding process information object
per Archive location.
```json
{}
```

---

### DELETE `/rest/v4/servers/{id}/rebuildArchive/{location}`

**Stop rebuilding Archive**

Stops rebuilding the Server "main" or "backup" Archive.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `location` | path | `main` \| `backup` | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/servers/*/rebuildArchive/{location}`

**Get Archives rebuild status**

Retrieves the status of the "main" or "backup" Archive rebuilding from all Servers.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `location` | path | `main` \| `backup` | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Storage rebuild process
information object per Server.
```json
{}
```

---

### DELETE `/rest/v4/servers/*/rebuildArchive/{location}`

**Stop rebuilding Archives**

Stops rebuilding the "main" or "backup" Archives for all Servers.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `location` | path | `main` \| `backup` | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Devices

### GET `/rest/v4/devices`

**Get Devices**

Retrieves all Device records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Device records.
```json
[
  {
    "parameters": {},
    "id": "{00000000-0000-0000-0000-000000000000}",
    "physicalId": "92-61-00-00-00-9F",
    "url": "192.168.0.1",
    "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
    "name": "Device 1",
    "mac": "string",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "isManuallyAdded": false,
    "vendor": "string",
    "model": "string",
    "group": {
      "id": "string",
      "name": "Group 1"
    },
    "credentials": {
      "user": "admin",
      "password": "password123"
    },
    "logicalId": "string",
    "options": {
      "isControlEnabled": false,
      "isAudioEnabled": false,
      "isDualStreamingDisabled": false,
      "dewarpingParams": "string",
      "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
      "failoverPriority": "Never",
      "backupQuality": "CameraBackupBoth",
      "backupContentType": "archive",
      "backupPolicy": "byDefault",
      "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
      "bitrateInfos": [
        {}
      ],
      "useBitratePerGop": false,
      "cameraHotspotsEnabled": false,
      "dontRecordSecondaryStream": false,
      "forcedMotionDetection": false,
      "ioOverlayStyle": "Form",
      "motionStream": "primary",
      "ioSettings": [
        {}
      ],
      "mediaPort": 0,
      "hasRtspSettings": false
    },
    "schedule": {
      "isEnabled": false,
      "tasks": [
        {}
      ],
      "minArchiveDays": 0,
      "maxArchiveDays": 0,
      "minArchivePeriodS": 0,
      "maxArchivePeriodS": 0
    },
    "motion": {
      "type": "default",
      "mask": "string",
      "recordBeforeS": 0,
      "recordAfterS": 0
    },
    "status": "Offline",
    "isLicenseUsed": false,
    "capabilities": "noCapabilities",
    "deviceType": "Unknown",
    "compatibleAnalyticsEngineIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "mediaCapabilities": {
      "streamCapabilities": {
        "primary": {},
        "secondary": {}
      },
      "hasDualStreaming": false,
      "hasAudio": false,
      "maxResolution": "string"
    },
    "mediaStreams": [
      {
        "encoderIndex": 0,
        "resolution": "string",
        "transports": "rtsp",
        "transcodingRequired": false,
        "codec": 0
      }
    ],
    "streamUrls": {},
    "userEnabledAnalyticsEngineIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "ptz": {
      "panTiltSensitivity": 1,
      "presetType": "undefined",
      "capabilities": "none",
      "configCapabilities": "none",
      "userModifiableCapabilities": "none",
      "userAddedCapabilities": "none"
    }
  }
]
```

---

### POST `/rest/v4/devices`

**Create Device**

Creates a record in the Site for the new Device. This method does not check for the Device
availability; use <code>POST /rest/v4/devices/&ast;/searches</code> with `mode` equal to
`addFoundDevices` whenever possible instead.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "",
  "model": "",
  "group": {
    "id": "",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "",
        "outputName": "",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": ""
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

*Required fields: `physicalId`, `url`, `typeId`*

**Responses:**

**default**: Device record that was created.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### GET `/rest/v4/devices/{id}`

**Get Device**

Retrieves the specified Device record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### PUT `/rest/v4/devices/{id}`

**Replace Device**

Replaces all fields of the specified Device record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "",
  "model": "",
  "group": {
    "id": "",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "",
        "outputName": "",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": ""
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

*Required fields: `physicalId`, `url`, `typeId`*

**Responses:**

**default**: Device record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### PATCH `/rest/v4/devices/{id}`

**Modify Device**

Modifies certain fields of the specified Device record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Device 1",
  "mac": "",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "",
  "model": "",
  "group": {
    "id": "",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "",
        "outputName": "",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": ""
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

**Responses:**

**default**: Device record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### DELETE `/rest/v4/devices/{id}`

**Delete Device**

Deletes the specified Device record from the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/*/types`

**Get Device Types**

Retrieves the list of the supported Device Types.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device type record.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "parentId": "{00000000-0000-0000-0000-000000000000}",
    "name": "string",
    "manufacturer": "string"
  }
]
```

---

### POST `/rest/v4/devices/*/searches`

**Start Device Search**

Starts a new Device Search in the Site. The Device Search results may be obtained by the
GET method and are recommended to be explicitly deleted by the DELETE method after that. The
results are available only for a limited time after the Device Search completion.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "port": 0,
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "mode": "waitResults",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "target": {
    "ip": "192.168.0.1"
  }
}
```

*Required fields: `target`*

**Responses:**

**default**: Device Search that was started.
```json
{
  "id": "string",
  "port": 0,
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "mode": "waitResults",
  "status": {
    "state": "Init",
    "current": "string",
    "total": "string"
  },
  "devices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "physicalId": "92-61-00-00-00-9F",
      "url": "192.168.0.1",
      "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
      "name": "Device 1",
      "mac": "string",
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "isManuallyAdded": false,
      "vendor": "string",
      "model": "string",
      "group": {
        "id": "string",
        "name": "Group 1"
      },
      "credentials": {
        "user": "admin",
        "password": "password123"
      },
      "wasAlreadyFound": false
    }
  ],
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "target": {
    "ip": "192.168.0.1"
  }
}
```

---

### GET `/rest/v4/devices/*/searches`

**Get Device Search list**

Retrieves information about all Device Searches currently running in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Device Search information.
```json
[
  {
    "id": "string",
    "port": 0,
    "credentials": {
      "user": "admin",
      "password": "password123"
    },
    "mode": "waitResults",
    "status": {
      "state": "Init",
      "current": "string",
      "total": "string"
    },
    "devices": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "physicalId": "92-61-00-00-00-9F",
        "url": "192.168.0.1",
        "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
        "name": "Device 1",
        "mac": "string",
        "serverId": "{00000000-0000-0000-0000-000000000000}",
        "isManuallyAdded": false,
        "vendor": "string",
        "model": "string",
        "group": {},
        "credentials": {},
        "wasAlreadyFound": false
      }
    ],
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "target": {
      "ip": "192.168.0.1"
    }
  }
]
```

---

### GET `/rest/v4/devices/*/searches/{id}`

**Get Device Search status**

Retrieves information about the particular Device Search running in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device Search id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device Search information.
```json
{
  "id": "string",
  "port": 0,
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "mode": "waitResults",
  "status": {
    "state": "Init",
    "current": "string",
    "total": "string"
  },
  "devices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "physicalId": "92-61-00-00-00-9F",
      "url": "192.168.0.1",
      "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
      "name": "Device 1",
      "mac": "string",
      "serverId": "{00000000-0000-0000-0000-000000000000}",
      "isManuallyAdded": false,
      "vendor": "string",
      "model": "string",
      "group": {
        "id": "string",
        "name": "Group 1"
      },
      "credentials": {
        "user": "admin",
        "password": "password123"
      },
      "wasAlreadyFound": false
    }
  ],
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "target": {
    "ip": "192.168.0.1"
  }
}
```

---

### DELETE `/rest/v4/devices/*/searches/{id}`

**Stop Device Search**

Deletes information about the particular Device Search from the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device Search id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/experimental/cameras`

**Get camera list**

<p><b>Proprietary.</b></p>

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/devices/{id}/changePassword`

**Change Device password**

Changes the password for the already existing User on the specified Device. This function
is allowed only for Devices with "SetUserPasswordCapability". Otherwise, it returns an error
in the JSON result.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "user": "admin",
  "password": "password123"
}
```

*Required fields: `user`, `password`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{id}/status`

**Get Device Diagnosis**

Retrieves the Device Diagnosis information for the particular Device.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device Diagnosis information.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "status": "Offline",
  "init": "string",
  "stream": "string",
  "media": "string"
}
```

---

### GET `/rest/v4/devices/*/status`

**Get all Devices' Diagnoses**

Retrieves the Device Diagnosis information for all Devices.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Device Diagnosis information.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "status": "Offline",
    "init": "string",
    "stream": "string",
    "media": "string"
  }
]
```

---

### GET `/rest/v4/devices/{id}/resourceData`

**Get Device's Resource data**

Retrieves the data from Device configuration file (resource_data.json) which is currently in
    use, for the particular Device.

> **Permissions:** Read Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device resource data information.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "data": {}
}
```

---

### GET `/rest/v4/devices/*/resourceData`

**Get all Devices' Resource data**

Retrieves the data from Device configuration file (resource_data.json) which is currently in
    use, for all Devices.

> **Permissions:** Read Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Device resource data.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "data": {}
  }
]
```

---

### POST `/rest/v4/devices/{id}/replace`

**Replace Device with another**

Replaces the Device with another one. The replaced Device is removed completely, and its
settings and Archive are transferred to the Device it is replaced with.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "replaceWithDeviceId": "",
  "dryRun": false
}
```

*Required fields: `replaceWithDeviceId`*

**Responses:**

**default**: Device replacement report.
```json
{
  "report": [
    {
      "name": "string",
      "level": "info",
      "messages": [
        "string"
      ]
    }
  ],
  "compatible": false
}
```

---

### DELETE `/rest/v4/devices/{id}/replace`

**Undo Device replacement**

Deletes the Device replacement record.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/devices/{id}/changeId`

**Change Device id**

Changes the Device id to a new unique value. The next discovery will find the Device with
the new id.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "newId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### DELETE `/rest/v4/devices/{id}/changeId`

**Undo Device id change**

Deletes the Device id change record.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{id}/advanced/*/manifest`

**Get Device Advanced manifest**

Retrieves the Device Advanced Parameter manifest.

> **Permissions:** Read Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device Advanced Manifest.
```json
{
  "name": "string",
  "version": "string",
  "pluginUniqueId": "string",
  "packet_mode": false,
  "groups": [
    {
      "name": "string",
      "description": "string",
      "aux": "string",
      "params": [
        {}
      ],
      "groups": [
        {}
      ]
    }
  ]
}
```

---

### GET `/rest/v4/devices/*/advanced/*/manifest`

**Get Device Advanced manifests**

Retrieves the Advanced Parameter manifests of all Devices.

> **Permissions:** Read Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Map with an Advanced Parameter manifest per Device.
```json
{}
```

---

### GET `/rest/v4/devices/{deviceId}/advanced/{id}`

**Get Device Advanced Parameter**

Retrieves the specified Advanced Parameter of the Device.

> **Permissions:** Read Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id to get Advanced Parameters from (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `id` | path | string | ✓ | Parameter id to read. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device Advanced Parameter.

---

### PUT `/rest/v4/devices/{deviceId}/advanced/{id}`

**Replace Device Adv. Parameter**

Replaces the single Device Advanced Parameter by passing a JSON value in the request body.
The complete list of Parameters with their types is returned by the "Get Device Advanced
Manifests" function.

> **Permissions:** Edit Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id to modify an Advanced Parameter for. |
| `id` | path | string | ✓ | Parameter id to modify. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{deviceId}/advanced`

**Get Device Advanced Parameters**

> **Permissions:** Read Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id to get Advanced Parameters from. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device Advanced Parameters and their values.
```json
{}
```

---

### PATCH `/rest/v4/devices/{deviceId}/advanced`

**Modify Device Adv. Parameters**

Modifies a bunch of Device Advanced Parameters by passing a JSON object with the parameter ids
and values in the request body. The complete list of ids with their types is returned by the
"Get Device Advanced manifests" function.

> **Permissions:** Edit Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id to modify Advanced Parameters for. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{}
```

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{deviceId}/io`

**Get Device IO States**

Returns current IO states from Device. This endpoint automatically initiates IO monitoring
if not already active. The monitoring session will timeout after ioPortMonitoringTimeoutS
seconds (defaults to 60) of inactivity. To maintain continuous monitoring, make periodic
calls to this endpoint.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id(s) to get input/output state of the port (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain Devices). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: IO states from Device.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "ports": {}
}
```

---

### PATCH `/rest/v4/devices/{deviceId}/io`

**Update Device IO State**

Update current IO State of Device.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id to set input/output states of ports (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "ports": {}
}
```

*Required fields: `ports`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/*/io`

**Get all Devices' IO States**

Returns current IO states from Devices. This endpoint automatically initiates IO monitoring
if not already active. The monitoring session will timeout after ioPortMonitoringTimeoutS
seconds (defaults to 60) of inactivity. To maintain continuous monitoring, make periodic
calls to this endpoint.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | query | array |  | Device id(s) to get input/output state of the port (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain Devices). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of IO states.
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "ports": {}
  }
]
```

---

### POST `/rest/v4/devices/{id}/intercom/rejectCall`

**Reject intercom call**

<p><b>Proprietary.</b></p>Rejects a call from the specified intercom Device if it is in progress.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/devices/{id}/intercom/acceptCall`

**Accept intercom call**

<p><b>Proprietary.</b></p>Accept a call from the specified intercom Device if it is in progress.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Device Media

### GET `/rest/v4/devices/*/bookmarks`

**Get Bookmarks**

Retrieves the Bookmark records stored in the Site.

> **Permissions:** View bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `startTimeMs` | query | string |  | Minimum start time for the Bookmark. |
| `endTimeMs` | query | string |  | Maximum end time for the Bookmark. |
| `centralTimePointMs` | query | string |  | Time point around which bookmarks are going to be returned. If parameter is specified then request returns nearest (by start time) limit/2 bookmarks before the split point and nearest limit/2 bookmarks after. To determinate nearest bookmarks start time field is taken into consideration. If there are bookmarks with the same start time then guid field is used to determine the order. After bookmarks are gathered they are sorted by the specified _orderBy. In case of ascending sorting (whatever the sorting _orderBy is) the split point is right after the specified time point. In case of descending order the split point is right before the specified time point. In addition to the sort field all returned bookmarks are sorted by the guid field. |
| `text` | query | string |  | Text-search filter string. Bookmarks can be found by their description or tag. This filter can contain several words, any of them can match a bookmark. Each of these words can match a bookmark if the caption or tag contains the Text-search word in the middle of its value. For example: a bookmark has tag1="12345", the search string "234" will match the bookmark. In case of several words are provided bookmark should contains all of them. If you need to find bookmark by any of them it is needed to use OR (case sensitive) word as a delimiter. For example: text="tag1 OR tag2". To search bookmarks by exact tag values add prefix "^" and suffix "$". In that mode tags have to be enclosed in double quotes and divided by AND or OR (case sensitive). Mixing AND and OR words is an error. Quotes can be omited for one word tags. Example: text=`^"first tag" AND "second tag"$` filters bookmarks that have both tags. Example: text=`^"first tag" OR "second tag"$` filters bookmarks that have any of tags. Example: text=`^tag123$` filters bookmarks that have tag "tag123". |
| `limit` | query | integer |  | Returned bookmark count limit. |
| `order` | query | `asc` \| `desc` |  | Result Bookmarks order. |
| `_orderBy` | query | `name` \| `startTimeMs` \| `durationMs` \| `creationTimeMs` \| `creator` \| `tags` \| `description` \| `deviceName` \| `creatorUserId` \| `deviceId` \| `id` |  | Bookmark field used for ordering. |
| `minVisibleLengthMs` | query | string |  | Minimum duration of returned Bookmarks. |
| `deviceId` | query | array |  | Device ids to get Bookmarks on. |
| `creationStartTimeMs` | query | string |  | Minimum creation time of the Bookmark (in milliseconds since epoch, or as a string). |
| `creationEndTimeMs` | query | string |  | Maximum creation time of the Bookmark (in milliseconds since epoch, or as a string). |
| `shareFilter` | query | `none` \| `shared` \| `notShared` \| `accessible` \| `hasExpiration` \| `expired` \| `passwordProtected` |  | Flags describing filters for shareable bookmarks |
| `column` | query | `name` \| `startTime` \| `duration` \| `creationTime` \| `creator` \| `tags` \| `description` \| `cameraName` |  | <p><b>Deprecated.</b> Use `_orderBy` instead.</p> |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Bookmark records.
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "name": "Bookmark",
    "description": "string",
    "startTimeMs": 0,
    "durationMs": 1000,
    "tags": [
      "string"
    ],
    "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
    "creationTimeMs": 0,
    "id": "string",
    "share": {
      "expirationTimeMs": 0,
      "password": "string"
    }
  }
]
```

---

### GET `/rest/v4/devices/{deviceId}/bookmarks`

**Get Device Bookmarks**

Retrieves the Bookmark records stored in the Site for the particular Device.

> **Permissions:** View bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `startTimeMs` | query | string |  | Minimum start time for the Bookmark. |
| `endTimeMs` | query | string |  | Maximum end time for the Bookmark. |
| `centralTimePointMs` | query | string |  | Time point around which bookmarks are going to be returned. If parameter is specified then request returns nearest (by start time) limit/2 bookmarks before the split point and nearest limit/2 bookmarks after. To determinate nearest bookmarks start time field is taken into consideration. If there are bookmarks with the same start time then guid field is used to determine the order. After bookmarks are gathered they are sorted by the specified _orderBy. In case of ascending sorting (whatever the sorting _orderBy is) the split point is right after the specified time point. In case of descending order the split point is right before the specified time point. In addition to the sort field all returned bookmarks are sorted by the guid field. |
| `text` | query | string |  | Text-search filter string. Bookmarks can be found by their description or tag. This filter can contain several words, any of them can match a bookmark. Each of these words can match a bookmark if the caption or tag contains the Text-search word in the middle of its value. For example: a bookmark has tag1="12345", the search string "234" will match the bookmark. In case of several words are provided bookmark should contains all of them. If you need to find bookmark by any of them it is needed to use OR (case sensitive) word as a delimiter. For example: text="tag1 OR tag2". To search bookmarks by exact tag values add prefix "^" and suffix "$". In that mode tags have to be enclosed in double quotes and divided by AND or OR (case sensitive). Mixing AND and OR words is an error. Quotes can be omited for one word tags. Example: text=`^"first tag" AND "second tag"$` filters bookmarks that have both tags. Example: text=`^"first tag" OR "second tag"$` filters bookmarks that have any of tags. Example: text=`^tag123$` filters bookmarks that have tag "tag123". |
| `limit` | query | integer |  | Returned bookmark count limit. |
| `order` | query | `asc` \| `desc` |  | Result Bookmarks order. |
| `_orderBy` | query | `name` \| `startTimeMs` \| `durationMs` \| `creationTimeMs` \| `creator` \| `tags` \| `description` \| `deviceName` \| `creatorUserId` \| `deviceId` \| `id` |  | Bookmark field used for ordering. |
| `minVisibleLengthMs` | query | string |  | Minimum duration of returned Bookmarks. |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId"     field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `creationStartTimeMs` | query | string |  | Minimum creation time of the Bookmark (in milliseconds since epoch, or as a string). |
| `creationEndTimeMs` | query | string |  | Maximum creation time of the Bookmark (in milliseconds since epoch, or as a string). |
| `shareFilter` | query | `none` \| `shared` \| `notShared` \| `accessible` \| `hasExpiration` \| `expired` \| `passwordProtected` |  | Flags describing filters for shareable bookmarks |
| `column` | query | `name` \| `startTime` \| `duration` \| `creationTime` \| `creator` \| `tags` \| `description` \| `cameraName` |  | <p><b>Deprecated.</b> Use `_orderBy` instead.</p> |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of Bookmark records.
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "name": "Bookmark",
    "description": "string",
    "startTimeMs": 0,
    "durationMs": 1000,
    "tags": [
      "string"
    ],
    "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
    "creationTimeMs": 0,
    "id": "string",
    "share": {
      "expirationTimeMs": 0,
      "password": "string"
    }
  }
]
```

---

### POST `/rest/v4/devices/{deviceId}/bookmarks`

**Create Bookmark**

Creates a record in the Site for the new Bookmark.

> **Permissions:** Manage bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string(uuid) | ✓ | Device id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Bookmark",
  "description": "",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    ""
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "share": {
    "expirationTimeMs": 0,
    "password": ""
  }
}
```

*Required fields: `name`, `durationMs`*

**Responses:**

**default**: Bookmark record that was created.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Bookmark",
  "description": "string",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    "string"
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "creationTimeMs": 0,
  "id": "string",
  "share": {
    "expirationTimeMs": 0,
    "password": "string"
  }
}
```

---

### GET `/rest/v4/devices/{deviceId}/bookmarks/{id}`

**Get Bookmark**

Retrieves the particular Bookmark record stored in the Site.

> **Permissions:** View bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `startTimeMs` | query | string |  | Minimum start time for the Bookmark. |
| `endTimeMs` | query | string |  | Maximum end time for the Bookmark. |
| `centralTimePointMs` | query | string |  | Time point around which bookmarks are going to be returned. If parameter is specified then request returns nearest (by start time) limit/2 bookmarks before the split point and nearest limit/2 bookmarks after. To determinate nearest bookmarks start time field is taken into consideration. If there are bookmarks with the same start time then guid field is used to determine the order. After bookmarks are gathered they are sorted by the specified _orderBy. In case of ascending sorting (whatever the sorting _orderBy is) the split point is right after the specified time point. In case of descending order the split point is right before the specified time point. In addition to the sort field all returned bookmarks are sorted by the guid field. |
| `text` | query | string |  | Text-search filter string. Bookmarks can be found by their description or tag. This filter can contain several words, any of them can match a bookmark. Each of these words can match a bookmark if the caption or tag contains the Text-search word in the middle of its value. For example: a bookmark has tag1="12345", the search string "234" will match the bookmark. In case of several words are provided bookmark should contains all of them. If you need to find bookmark by any of them it is needed to use OR (case sensitive) word as a delimiter. For example: text="tag1 OR tag2". To search bookmarks by exact tag values add prefix "^" and suffix "$". In that mode tags have to be enclosed in double quotes and divided by AND or OR (case sensitive). Mixing AND and OR words is an error. Quotes can be omited for one word tags. Example: text=`^"first tag" AND "second tag"$` filters bookmarks that have both tags. Example: text=`^"first tag" OR "second tag"$` filters bookmarks that have any of tags. Example: text=`^tag123$` filters bookmarks that have tag "tag123". |
| `limit` | query | integer |  | Returned bookmark count limit. |
| `order` | query | `asc` \| `desc` |  | Result Bookmarks order. |
| `_orderBy` | query | `name` \| `startTimeMs` \| `durationMs` \| `creationTimeMs` \| `creator` \| `tags` \| `description` \| `deviceName` \| `creatorUserId` \| `deviceId` \| `id` |  | Bookmark field used for ordering. |
| `minVisibleLengthMs` | query | string |  | Minimum duration of returned Bookmarks. |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId"     field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `creationStartTimeMs` | query | string |  | Minimum creation time of the Bookmark (in milliseconds since epoch, or as a string). |
| `creationEndTimeMs` | query | string |  | Maximum creation time of the Bookmark (in milliseconds since epoch, or as a string). |
| `id` | path | string | ✓ | Combined Bookmark and Server ids `{bookmarkId}_{serverId}`. |
| `shareFilter` | query | `none` \| `shared` \| `notShared` \| `accessible` \| `hasExpiration` \| `expired` \| `passwordProtected` |  | Flags describing filters for shareable bookmarks |
| `column` | query | `name` \| `startTime` \| `duration` \| `creationTime` \| `creator` \| `tags` \| `description` \| `cameraName` |  | <p><b>Deprecated.</b> Use `_orderBy` instead.</p> |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Bookmark record.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Bookmark",
  "description": "string",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    "string"
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "creationTimeMs": 0,
  "id": "string",
  "share": {
    "expirationTimeMs": 0,
    "password": "string"
  }
}
```

---

### PUT `/rest/v4/devices/{deviceId}/bookmarks/{id}`

**Replace Bookmark**

Replaces all fields of the particular Bookmark record stored in the Site.

> **Permissions:** Manage bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string(uuid) | ✓ | Device id. |
| `id` | path | string | ✓ | Combined Bookmark and Server ids `{bookmarkId}_{serverId}`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Bookmark",
  "description": "",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    ""
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "share": {
    "expirationTimeMs": 0,
    "password": ""
  }
}
```

*Required fields: `name`, `durationMs`*

**Responses:**

**default**: Bookmark record.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Bookmark",
  "description": "string",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    "string"
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "creationTimeMs": 0,
  "id": "string",
  "share": {
    "expirationTimeMs": 0,
    "password": "string"
  }
}
```

---

### PATCH `/rest/v4/devices/{deviceId}/bookmarks/{id}`

**Modify Bookmark**

Modifies certain fields of the particular Bookmark record stored in the Site.

> **Permissions:** Manage bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string(uuid) | ✓ | Device id. |
| `id` | path | string | ✓ | Combined Bookmark and Server ids `{bookmarkId}_{serverId}`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Bookmark",
  "description": "",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    ""
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "share": {
    "expirationTimeMs": 0,
    "password": ""
  }
}
```

**Responses:**

**default**: Bookmark record.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Bookmark",
  "description": "string",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    "string"
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "creationTimeMs": 0,
  "id": "string",
  "share": {
    "expirationTimeMs": 0,
    "password": "string"
  }
}
```

---

### DELETE `/rest/v4/devices/*/bookmarks/{id}`

**Delete Bookmark**

Deletes the particular Bookmark record from the Site.

> **Permissions:** Manage bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Combined Bookmark and Server ids `{bookmarkId}_{serverId}`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/*/bookmarks/*/tags`

**Get Bookmark tags**

Retrieves the Bookmark tags.

> **Permissions:** View bookmarks.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: All tags with Bookmark counters.

---

### GET `/rest/v4/devices/*/bookmarks/{id}/description`

**Get Bookmark Description**

Retrieves a description of the specified shared Bookmark. Does not require authorization,
but must require the password parameter if sharing specifies one.

> **Permissions:** None if not password protected, Bookmark password otherwise.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Combined Bookmark and Server ids `{bookmarkId}_{serverId}`. |
| `passwordProtection` | query | string |  | Password protection used to authenticate the request if the Bookmark is password protected. Should be calculated as `synchronizedTimeMs + ":" + sha256hex(sha256hex(bookmarkId + password) + synchronizedTimeMs))` where `synchronizedTimeMs` should be obtained from `/rest/v4/site/info`. Example: ``` bookmarkId = '997d0166-0479-473f-8578-9b1c5aee14c6_00000000-8aeb-7d56-2bc7-67afae00335c' password = 'password123' synchronizedTimeMs = 1707754215123 sha256hex(997d0166-0479-473f-8578-9b1c5aee14c6_00000000-8aeb-7d56-2bc7-67afae00335cpassword123) -- adad72a3a64631cfdbe5726b3c7a314df664f34905fae81266d302a91135b8c7 sha256hex(adad72a3a64631cfdbe5726b3c7a314df664f34905fae81266d302a91135b8c71707754215123) -- 0e91c8bb106a4fcf1a407d896a21c6a96a7ed40c6161403af99985c3f1d405f7 ?passwordProtection=1707754215123:0e91c8bb106a4fcf1a407d896a21c6a96a7ed40c6161403af99985c3f1d405f7 ``` |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Description of Bookmark.
```json
{
  "name": "Bookmark",
  "description": "string",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    "string"
  ],
  "id": "string"
}
```

---

### GET `/rest/v4/devices/*/bookmarks/{bookmarkId}/media`

**Bookmark HTTP Stream**

Opens an HTTP video stream linked to the specified bookmark. Does not require authorization
if the Bookmark is shared, but must require the password parameter if sharing specifies one.
If required and possible, media stream transcoding is performed on-the-fly. Bookmark Media
Example can be found here [/ui/bookmark.html](/ui/bookmark.html). Not supported by
iOS-based devices, in that case use: `/bookmarks/{bookmarkId}/hls`

> **Permissions:** None if not password protected, Bookmark password otherwise.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `stream` | query | `primary` \| `secondary` |  | If unspecified, Server auto-detects the preferred stream index based on the destination resolution.  Possible values are: - `"primary"` High-resolution stream. - `"secondary"` Low-resolution stream. |
| `resolution` | query | string |  | Specifies the exact resolution to be used for the output video. The resolution format is `{width}x{height}` (for example, "320x240") or can be defined using a height-only format (for example, "240p"). When provided, this option ensures that the output is rendered at the specified resolution. If both this option and `resolutionWhenTranscoding` are supplied, this option takes precedence. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `resolutionWhenTranscoding` | query | string |  | Specifies the resolution to be used only if the video is transcoded. This option applies when transcoding is triggered (either through other transcoding settings or because the original stream's codec is incompatible with the client request). The resolution format is `{width}x{height}` (for example, "320x240") or can use a height-only format (for example, "240p"). If the `resolution` option is also provided, it will override this setting. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `rotation` | query | string |  | A transcoding option. Item rotation, in degrees. If the parameter is `auto`, the video will be rotated to the default value defined in the Device Settings dialog.  Possible values are: - `"auto"` - `"0"` - `"90"` - `"180"` - `"270"` |
| `aspectRatio` | query | string |  | A transcoding option. Item aspect ratio, e.g. '4:3' or '16:9'. If the parameter is `auto`, the video aspect ratio would be taken from the default value defined in the Device Settings dialog. If the parameter is empty, it will force to don't transcode regardless of the option value in the Device Settings. |
| `dewarping` | query | boolean |  | A transcoding option. Image dewarping. If the parameter is absent, image dewarping will depend on the value in the Device settings dialog. |
| `dewarpingXangle` | query | number |  | A transcoding option. Dewarping pan in radians. |
| `dewarpingYangle` | query | number |  | A transcoding option. Dewarping tilt in radians. |
| `dewarpingFov` | query | number |  | A transcoding option. Dewarping field of view in radians. |
| `dewarpingPanofactor` | query | integer |  | A transcoding option. Dewarping aspect ratio correction multiplier (1, 2 or 4). |
| `zoom` | query | string |  | A transcoding option. Zooms the selected image region. The format is `{x},{y},{width}x{height}` with values in range [0..1]. |
| `panoramic` | query | boolean |  | A transcoding option. Transcodes a multi-sensor camera into one stream. |
| `videoCodec` | query | string |  | Forces specific video codec. Causes error response if specified codec is not found or not supported for selected particular container (see `format`). |
| `quality` | query | `lowest` \| `low` \| `normal` \| `high` \| `highest` \| `preset` \| `undefined` |  | Video quality. |
| `dropLateFrames` | query | integer |  | Drop Late Frames. |
| `standFrameDuration` | query | boolean |  | Stand Frame Duration. If the parameter is present, the video speed is limited by the real time. |
| `realTimeOptimization` | query | boolean |  | Turn on the realtime optimization. It will drop some frames if there is not enough CPU for the realtime transcoding. |
| `audioOnly` | query | boolean |  | Send only the audio stream. |
| `accurateSeek` | query | boolean |  | Seek to the exact time in the Archive by the specified `pos`, otherwise seek to the nearest left to the `pos` keyframe (on timeline). Enabling causes the stream to be transcoded. Disabled by default. |
| `durationMs` | query | string |  | Fragment length in milliseconds. |
| `signature` | query | boolean |  | Add signature to exported media data, only mp4 and webm formats are supported. |
| `utcTimestamps` | query | boolean |  | Use absolute UTC timestamps in exported media data, only mp4 format is supported. |
| `continuousTimestamps` | query | boolean |  | <p><b>Deprecated.</b> Add continuous timestamps in exported media data. Always true, regardless of the parameter value.</p> |
| `passwordProtection` | query | string |  | Password protection used to authenticate the request if the Bookmark is password protected. Should be calculated as `synchronizedTimeMs + ":" + sha256hex(sha256hex(bookmarkId + password) + synchronizedTimeMs))` where `synchronizedTimeMs` should be obtained from `/rest/v4/site/info`. Example: ``` bookmarkId = '997d0166-0479-473f-8578-9b1c5aee14c6_00000000-8aeb-7d56-2bc7-67afae00335c' password = 'password123' synchronizedTimeMs = 1707754215123 sha256hex(997d0166-0479-473f-8578-9b1c5aee14c6_00000000-8aeb-7d56-2bc7-67afae00335cpassword123) -- adad72a3a64631cfdbe5726b3c7a314df664f34905fae81266d302a91135b8c7 sha256hex(adad72a3a64631cfdbe5726b3c7a314df664f34905fae81266d302a91135b8c71707754215123) -- 0e91c8bb106a4fcf1a407d896a21c6a96a7ed40c6161403af99985c3f1d405f7 ?passwordProtection=1707754215123:0e91c8bb106a4fcf1a407d896a21c6a96a7ed40c6161403af99985c3f1d405f7 ``` |
| `bookmarkId` | path | string | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Media Stream.

---

### GET `/rest/v4/devices/*/bookmarks/{bookmarkId}/media.{format}`

**Bookmark HTTP Stream (format)**

Opens an HTTP video stream linked to the specified bookmark. Does not require authorization
if the Bookmark is shared, but must require the password parameter if sharing specifies one.
If required and possible, media stream transcoding is performed on-the-fly. Bookmark Media
Example can be found here [/ui/bookmark.html](/ui/bookmark.html).

> **Permissions:** None if not password protected, Bookmark password otherwise.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `stream` | query | `primary` \| `secondary` |  | If unspecified, Server auto-detects the preferred stream index based on the destination resolution.  Possible values are: - `"primary"` High-resolution stream. - `"secondary"` Low-resolution stream. |
| `resolution` | query | string |  | Specifies the exact resolution to be used for the output video. The resolution format is `{width}x{height}` (for example, "320x240") or can be defined using a height-only format (for example, "240p"). When provided, this option ensures that the output is rendered at the specified resolution. If both this option and `resolutionWhenTranscoding` are supplied, this option takes precedence. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `resolutionWhenTranscoding` | query | string |  | Specifies the resolution to be used only if the video is transcoded. This option applies when transcoding is triggered (either through other transcoding settings or because the original stream's codec is incompatible with the client request). The resolution format is `{width}x{height}` (for example, "320x240") or can use a height-only format (for example, "240p"). If the `resolution` option is also provided, it will override this setting. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `rotation` | query | string |  | A transcoding option. Item rotation, in degrees. If the parameter is `auto`, the video will be rotated to the default value defined in the Device Settings dialog.  Possible values are: - `"auto"` - `"0"` - `"90"` - `"180"` - `"270"` |
| `aspectRatio` | query | string |  | A transcoding option. Item aspect ratio, e.g. '4:3' or '16:9'. If the parameter is `auto`, the video aspect ratio would be taken from the default value defined in the Device Settings dialog. If the parameter is empty, it will force to don't transcode regardless of the option value in the Device Settings. |
| `dewarping` | query | boolean |  | A transcoding option. Image dewarping. If the parameter is absent, image dewarping will depend on the value in the Device settings dialog. |
| `dewarpingXangle` | query | number |  | A transcoding option. Dewarping pan in radians. |
| `dewarpingYangle` | query | number |  | A transcoding option. Dewarping tilt in radians. |
| `dewarpingFov` | query | number |  | A transcoding option. Dewarping field of view in radians. |
| `dewarpingPanofactor` | query | integer |  | A transcoding option. Dewarping aspect ratio correction multiplier (1, 2 or 4). |
| `zoom` | query | string |  | A transcoding option. Zooms the selected image region. The format is `{x},{y},{width}x{height}` with values in range [0..1]. |
| `panoramic` | query | boolean |  | A transcoding option. Transcodes a multi-sensor camera into one stream. |
| `videoCodec` | query | string |  | Forces specific video codec. Causes error response if specified codec is not found or not supported for selected particular container (see `format`). |
| `format` | path | `webm` \| `mpegts` \| `mpjpeg` \| `mp4` \| `mkv` \| `_3gp` \| `rtp` \| `flv` \| `f4v` | ✓ | Stream format. |
| `quality` | query | `lowest` \| `low` \| `normal` \| `high` \| `highest` \| `preset` \| `undefined` |  | Video quality. |
| `dropLateFrames` | query | integer |  | Drop Late Frames. |
| `standFrameDuration` | query | boolean |  | Stand Frame Duration. If the parameter is present, the video speed is limited by the real time. |
| `realTimeOptimization` | query | boolean |  | Turn on the realtime optimization. It will drop some frames if there is not enough CPU for the realtime transcoding. |
| `audioOnly` | query | boolean |  | Send only the audio stream. |
| `accurateSeek` | query | boolean |  | Seek to the exact time in the Archive by the specified `pos`, otherwise seek to the nearest left to the `pos` keyframe (on timeline). Enabling causes the stream to be transcoded. Disabled by default. |
| `durationMs` | query | string |  | Fragment length in milliseconds. |
| `signature` | query | boolean |  | Add signature to exported media data, only mp4 and webm formats are supported. |
| `utcTimestamps` | query | boolean |  | Use absolute UTC timestamps in exported media data, only mp4 format is supported. |
| `continuousTimestamps` | query | boolean |  | <p><b>Deprecated.</b> Add continuous timestamps in exported media data. Always true, regardless of the parameter value.</p> |
| `passwordProtection` | query | string |  | Password protection used to authenticate the request if the Bookmark is password protected. Should be calculated as `synchronizedTimeMs + ":" + sha256hex(sha256hex(bookmarkId + password) + synchronizedTimeMs))` where `synchronizedTimeMs` should be obtained from `/rest/v4/site/info`. Example: ``` bookmarkId = '997d0166-0479-473f-8578-9b1c5aee14c6_00000000-8aeb-7d56-2bc7-67afae00335c' password = 'password123' synchronizedTimeMs = 1707754215123 sha256hex(997d0166-0479-473f-8578-9b1c5aee14c6_00000000-8aeb-7d56-2bc7-67afae00335cpassword123) -- adad72a3a64631cfdbe5726b3c7a314df664f34905fae81266d302a91135b8c7 sha256hex(adad72a3a64631cfdbe5726b3c7a314df664f34905fae81266d302a91135b8c71707754215123) -- 0e91c8bb106a4fcf1a407d896a21c6a96a7ed40c6161403af99985c3f1d405f7 ?passwordProtection=1707754215123:0e91c8bb106a4fcf1a407d896a21c6a96a7ed40c6161403af99985c3f1d405f7 ``` |
| `bookmarkId` | path | string | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Media Stream.

---

### GET `/rest/v4/devices/{id}/image`

**Get Device thumbnail**

Retrieves a thumbnail image from the Device.

> **Permissions:** View live or Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Device id. |
| `timestampMs` | query | string |  | Timestamp of the image. A negative value means "latest". |
| `ignoreExternalArchive` | query | boolean |  | If enabled, images requested with "Latest" option will not be tried to download from an external archive like NVR. |
| `rotation` | query | integer |  | Forced rotation. Negative value means take default rotation from the device settings. |
| `size` | query | string |  | Image size, format `{width}x{height}`. Any valid value must not be less than 32 and not larger than 4096, or it can be less than or equal to 0 to indicate auto-sizing. During auto-sizing if only height or only width is positive then aspect ratio is used to calculate the other value, and if both values are not positive then the original frame size is used. |
| `format` | query | `png` \| `jpg` \| `tif` \| `raw` \| `_auto` |  | Resulting image format. Default is `jpg`.  Possible values are: - `"png"` - `"jpg"` - `"tif"` - `"raw"` Raw source image. For frames from video archive source video frame is decoded, but not encoded. Usually such frames stay in YUV format. For frames provided by video analytics they stay in source image format same as for value `auto`. - `"_auto"` If source frame represented in jpg/png/tif format then keep it. Otherwise if source frame is video frame, then encode it to the jpg format. |
| `roundMethod` | query | `before` \| `precise` \| `after` |  | Method of rounding, influences the precision. Round after is better for most situations.  Possible values are: - `"before"` Get the thumbnail from the nearest keyframe before the given time. - `"precise"` Get the thumbnail as near to given time as possible. - `"after"` Get the thumbnail from the nearest keyframe after the given time. |
| `aspectRatio` | query | `auto_` \| `source` |  | Aspect ratio. |
| `tolerant` | query | boolean |  | Whether it's allowed to get the closest available frame if there's no archive at the requested time. |
| `crop` | query | string |  | Crop image, format `{x},{y},{width}x{height}` with values in range [0..1] |
| `streamSelectionMode` | query | `auto_` \| `forcedPrimary` \| `forcedSecondary` \| `sameAsMotion` \| `sameAsAnalytics` |  | Stream choice. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Thumbnail image.

---

### GET `/rest/v4/devices/{id}/media`

**Device HTTP Stream**

Opens an HTTP video stream from the Device. It is not exactly an API function but rather a
URL format which may contain any Device id. Live stream and archive can be downloaded. If
required and possible, media stream transcoding is performed on-the-fly.

> **Permissions:** View live or Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `stream` | query | `primary` \| `secondary` |  | If unspecified, Server auto-detects the preferred stream index based on the destination resolution.  Possible values are: - `"primary"` High-resolution stream. - `"secondary"` Low-resolution stream. |
| `positionMs` | query | string |  | If present, specifies the Archive stream start position. Otherwise, the Live stream is provided. |
| `resolution` | query | string |  | Specifies the exact resolution to be used for the output video. The resolution format is `{width}x{height}` (for example, "320x240") or can be defined using a height-only format (for example, "240p"). When provided, this option ensures that the output is rendered at the specified resolution. If both this option and `resolutionWhenTranscoding` are supplied, this option takes precedence. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `resolutionWhenTranscoding` | query | string |  | Specifies the resolution to be used only if the video is transcoded. This option applies when transcoding is triggered (either through other transcoding settings or because the original stream's codec is incompatible with the client request). The resolution format is `{width}x{height}` (for example, "320x240") or can use a height-only format (for example, "240p"). If the `resolution` option is also provided, it will override this setting. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `rotation` | query | string |  | A transcoding option. Item rotation, in degrees. If the parameter is `auto`, the video will be rotated to the default value defined in the Device Settings dialog.  Possible values are: - `"auto"` - `"0"` - `"90"` - `"180"` - `"270"` |
| `aspectRatio` | query | string |  | A transcoding option. Item aspect ratio, e.g. '4:3' or '16:9'. If the parameter is `auto`, the video aspect ratio would be taken from the default value defined in the Device Settings dialog. If the parameter is empty, it will force to don't transcode regardless of the option value in the Device Settings. |
| `dewarping` | query | boolean |  | A transcoding option. Image dewarping. If the parameter is absent, image dewarping will depend on the value in the Device settings dialog. |
| `dewarpingXangle` | query | number |  | A transcoding option. Dewarping pan in radians. |
| `dewarpingYangle` | query | number |  | A transcoding option. Dewarping tilt in radians. |
| `dewarpingFov` | query | number |  | A transcoding option. Dewarping field of view in radians. |
| `dewarpingPanofactor` | query | integer |  | A transcoding option. Dewarping aspect ratio correction multiplier (1, 2 or 4). |
| `zoom` | query | string |  | A transcoding option. Zooms the selected image region. The format is `{x},{y},{width}x{height}` with values in range [0..1]. |
| `panoramic` | query | boolean |  | A transcoding option. Transcodes a multi-sensor camera into one stream. |
| `videoCodec` | query | string |  | Forces specific video codec. Causes error response if specified codec is not found or not supported for selected particular container (see `format`). |
| `quality` | query | `lowest` \| `low` \| `normal` \| `high` \| `highest` \| `preset` \| `undefined` |  | Video quality. |
| `endPositionMs` | query | string |  | If present, specifies the Archive stream end position. It is used only if the `positionMs` parameter is present. |
| `dropLateFrames` | query | integer |  | Drop Late Frames. |
| `standFrameDuration` | query | boolean |  | Stand Frame Duration. If the parameter is present, the video speed is limited by the real time. |
| `realTimeOptimization` | query | boolean |  | Turn on the realtime optimization. It will drop some frames if there is not enough CPU for the realtime transcoding. |
| `audioOnly` | query | boolean |  | Send only the audio stream. |
| `accurateSeek` | query | boolean |  | Seek to the exact time in the Archive by the specified `pos`, otherwise seek to the nearest left to the `pos` keyframe (on timeline). Enabling causes the stream to be transcoded. Disabled by default. |
| `durationMs` | query | string |  | Can be used for both live and archive streams - for archive streams effectively it's another way to specify `endPositionMs`. |
| `signature` | query | boolean |  | Add signature to exported media data, only mp4 and webm formats are supported. |
| `utcTimestamps` | query | boolean |  | Use absolute UTC timestamps in exported media data, only mp4 format is supported. |
| `continuousTimestamps` | query | boolean |  | <p><b>Deprecated.</b> Add continuous timestamps in exported media data. Always true, regardless of the parameter value.</p> |
| `download` | query | boolean |  | Force to download file in browser instead of displaying it. |
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Media Stream.

---

### GET `/rest/v4/devices/{id}/media.{format}`

**Device HTTP Stream (format)**

Opens an HTTP video stream from the Device. It is not exactly an API function but rather a
URL format which may contain any Device id. Live stream and archive can be downloaded. If
required and possible, media stream transcoding is performed on-the-fly.

> **Permissions:** View live or Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `stream` | query | `primary` \| `secondary` |  | If unspecified, Server auto-detects the preferred stream index based on the destination resolution.  Possible values are: - `"primary"` High-resolution stream. - `"secondary"` Low-resolution stream. |
| `positionMs` | query | string |  | If present, specifies the Archive stream start position. Otherwise, the Live stream is provided. |
| `resolution` | query | string |  | Specifies the exact resolution to be used for the output video. The resolution format is `{width}x{height}` (for example, "320x240") or can be defined using a height-only format (for example, "240p"). When provided, this option ensures that the output is rendered at the specified resolution. If both this option and `resolutionWhenTranscoding` are supplied, this option takes precedence. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `resolutionWhenTranscoding` | query | string |  | Specifies the resolution to be used only if the video is transcoded. This option applies when transcoding is triggered (either through other transcoding settings or because the original stream's codec is incompatible with the client request). The resolution format is `{width}x{height}` (for example, "320x240") or can use a height-only format (for example, "240p"). If the `resolution` option is also provided, it will override this setting. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `rotation` | query | string |  | A transcoding option. Item rotation, in degrees. If the parameter is `auto`, the video will be rotated to the default value defined in the Device Settings dialog.  Possible values are: - `"auto"` - `"0"` - `"90"` - `"180"` - `"270"` |
| `aspectRatio` | query | string |  | A transcoding option. Item aspect ratio, e.g. '4:3' or '16:9'. If the parameter is `auto`, the video aspect ratio would be taken from the default value defined in the Device Settings dialog. If the parameter is empty, it will force to don't transcode regardless of the option value in the Device Settings. |
| `dewarping` | query | boolean |  | A transcoding option. Image dewarping. If the parameter is absent, image dewarping will depend on the value in the Device settings dialog. |
| `dewarpingXangle` | query | number |  | A transcoding option. Dewarping pan in radians. |
| `dewarpingYangle` | query | number |  | A transcoding option. Dewarping tilt in radians. |
| `dewarpingFov` | query | number |  | A transcoding option. Dewarping field of view in radians. |
| `dewarpingPanofactor` | query | integer |  | A transcoding option. Dewarping aspect ratio correction multiplier (1, 2 or 4). |
| `zoom` | query | string |  | A transcoding option. Zooms the selected image region. The format is `{x},{y},{width}x{height}` with values in range [0..1]. |
| `panoramic` | query | boolean |  | A transcoding option. Transcodes a multi-sensor camera into one stream. |
| `videoCodec` | query | string |  | Forces specific video codec. Causes error response if specified codec is not found or not supported for selected particular container (see `format`). |
| `format` | path | `webm` \| `mpegts` \| `mpjpeg` \| `mp4` \| `mkv` \| `_3gp` \| `rtp` \| `flv` \| `f4v` | ✓ | Stream format. |
| `quality` | query | `lowest` \| `low` \| `normal` \| `high` \| `highest` \| `preset` \| `undefined` |  | Video quality. |
| `endPositionMs` | query | string |  | If present, specifies the Archive stream end position. It is used only if the `positionMs` parameter is present. |
| `dropLateFrames` | query | integer |  | Drop Late Frames. |
| `standFrameDuration` | query | boolean |  | Stand Frame Duration. If the parameter is present, the video speed is limited by the real time. |
| `realTimeOptimization` | query | boolean |  | Turn on the realtime optimization. It will drop some frames if there is not enough CPU for the realtime transcoding. |
| `audioOnly` | query | boolean |  | Send only the audio stream. |
| `accurateSeek` | query | boolean |  | Seek to the exact time in the Archive by the specified `pos`, otherwise seek to the nearest left to the `pos` keyframe (on timeline). Enabling causes the stream to be transcoded. Disabled by default. |
| `durationMs` | query | string |  | Can be used for both live and archive streams - for archive streams effectively it's another way to specify `endPositionMs`. |
| `signature` | query | boolean |  | Add signature to exported media data, only mp4 and webm formats are supported. |
| `utcTimestamps` | query | boolean |  | Use absolute UTC timestamps in exported media data, only mp4 format is supported. |
| `continuousTimestamps` | query | boolean |  | <p><b>Deprecated.</b> Add continuous timestamps in exported media data. Always true, regardless of the parameter value.</p> |
| `download` | query | boolean |  | Force to download file in browser instead of displaying it. |
| `id` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Media Stream.

---

### GET `/rest/v4/devices/{id}/webrtc`

**Open WebRTC Tracker**

Opens a WebRTC Tracker WebSocket connection. This is an implementation of the offer/answer
model from https://datatracker.ietf.org/doc/html/rfc3264 via websockets as the transport
layer. This protocol is supported by the most of modern browsers based on Chromium or Gecko
engines. If required and possible, media stream transcoding is performed on-the-fly.
<br/>
Example:
<br/>
<code>wss://&lt;server_ip&gt;:&lt;port&gt;/rest/v4/devices/12AB42FD5912/webrtc</code>
<br/>
There is also an endpoint to a WebRTC web player provided by the Server. The endpoint can
be opened in a browser and can be used for embedding video steam playback into a web page.
The player uses the WebRTC Tracker endpoint under the hood.
<br/>
<code>https://&lt;server_ip&gt;:&lt;port&gt;/webrtc/?camera_id=12AB42FD5912&position=1674240507000000</code>
<br/>
Web player also supports all Tracker parameters:
<br/>
<code>https://&lt;server_ip&gt;:&lt;port&gt;/webrtc/?camera_id=12AB42FD5912&position=1674240507000000&stream=0&resolutionWhenTranscoding=320x240&resolution=240p&rotation=auto&speed=1.0&deliveryMethod=srtp</code>

> **Permissions:** View live or Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `stream` | query | `primary` \| `secondary` |  | If unspecified, Server auto-detects the preferred stream index based on the destination resolution.  Possible values are: - `"primary"` High-resolution stream. - `"secondary"` Low-resolution stream. |
| `positionMs` | query | string |  | If present, specifies the Archive stream start position. Otherwise, the Live stream is provided. |
| `resolution` | query | string |  | Specifies the exact resolution to be used for the output video. The resolution format is `{width}x{height}` (for example, "320x240") or can be defined using a height-only format (for example, "240p"). When provided, this option ensures that the output is rendered at the specified resolution. If both this option and `resolutionWhenTranscoding` are supplied, this option takes precedence. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `resolutionWhenTranscoding` | query | string |  | Specifies the resolution to be used only if the video is transcoded. This option applies when transcoding is triggered (either through other transcoding settings or because the original stream's codec is incompatible with the client request). The resolution format is `{width}x{height}` (for example, "320x240") or can use a height-only format (for example, "240p"). If the `resolution` option is also provided, it will override this setting. If neither option is set, the following defaults apply:   When transcoding is enabled:       For low or undefined streams: use the default secondary-stream resolution.       For high streams: use the lesser of 1080p and the high-stream's native resolution.   When transcoding is not enabled:       Use the primary stream's native resolution. |
| `rotation` | query | string |  | A transcoding option. Item rotation, in degrees. If the parameter is `auto`, the video will be rotated to the default value defined in the Device Settings dialog.  Possible values are: - `"auto"` - `"0"` - `"90"` - `"180"` - `"270"` |
| `aspectRatio` | query | string |  | A transcoding option. Item aspect ratio, e.g. '4:3' or '16:9'. If the parameter is `auto`, the video aspect ratio would be taken from the default value defined in the Device Settings dialog. If the parameter is empty, it will force to don't transcode regardless of the option value in the Device Settings. |
| `dewarping` | query | boolean |  | A transcoding option. Image dewarping. If the parameter is absent, image dewarping will depend on the value in the Device settings dialog. |
| `dewarpingXangle` | query | number |  | A transcoding option. Dewarping pan in radians. |
| `dewarpingYangle` | query | number |  | A transcoding option. Dewarping tilt in radians. |
| `dewarpingFov` | query | number |  | A transcoding option. Dewarping field of view in radians. |
| `dewarpingPanofactor` | query | integer |  | A transcoding option. Dewarping aspect ratio correction multiplier (1, 2 or 4). |
| `zoom` | query | string |  | A transcoding option. Zooms the selected image region. The format is `{x},{y},{width}x{height}` with values in range [0..1]. |
| `panoramic` | query | boolean |  | A transcoding option. Transcodes a multi-sensor camera into one stream. |
| `videoCodec` | query | string |  | Forces specific video codec. Causes error response if specified codec is not found or not supported for selected particular container (see `format`). |
| `id` | path | string(uuid) | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via /rest/v4/devices) or MAC address (not supported for certain Devices). |
| `speed` | query | string |  | If specified, regulates the speed of streaming from the Archive. Has no effect for live streaming.  Possible values are: - `"1.0"` Default value. - `"unlimited"` Stream with the maximum possible speed. |
| `deliveryMethod` | query | `srtp` \| `mse` |  | Media delivery method.  Possible values are: - `"srtp"` Use Secure RTP (a standard way). - `"mse"` Use media chunks via Data Channel (a non-standard way). |
| `unreliableTransport` | query | boolean |  | If specified, don't resend lost UDP packets. |
| `mseFormat` | query | `mpegts` \| `mp4` |  | MSE delivery only, media format(container) in which media data will be mixed. |
| `sendTimestampIntervalMs` | query | string |  | Specifies the interval at which the timestamp is sent. If it is zero, it will be sent every frame. |
| `enableMetadata` | query | boolean |  | If specified, metadata will be sent via data channel in JSON format. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Video stream in WebRTC format.

---

### GET `/rest/v4/devices/{id}/webrtc-camera`

**WebRTC Tracker into Device**

Opens a WebRTC Tracker WebSocket connection. This is an implementation of the offer/answer
model from https://datatracker.ietf.org/doc/html/rfc3264 via websockets as the transport
layer. This protocol is supported by the most of modern browsers based on Chromium or Gecko
engines. This Tracker is introduced for receiving video stream from WebRTC camera.
<br/>
Example:
</br>
<code>wss://&lt;server_ip&gt;:&lt;port&gt;/rest/v4/devices/12AB42FD5912/webrtc-camera</code>
<br/>
There is also an endpoint to a WebRTC camera receiver provided by the Server. The endpoint can
be opened in a browser and can be used for streaming video from your browser into a Server.
The player uses the WebRTC Tracker endpoint under the hood.
<code>https://&lt;server_ip&gt;:&lt;port&gt;/webrtc-camera</code>

> **Permissions:** Read, write and save permissions on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via /rest/v4/devices) or MAC address (not supported for certain Devices). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: None.

---

### GET `/rest/v4/devices/{id}/footage`

**Get Device footage**

Retrieves the info for the recorded chunks for the Device specified by {id}.

> **Permissions:** View Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Device id(s) to get Footage on. It can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`. MAC address can also be used but it is not supported for certain Devices. |
| `startTimeMs` | query | string |  | Start time of the interval to search for chunks, in milliseconds. |
| `endTimeMs` | query | string |  | End time of the interval to search for chunks, in milliseconds. |
| `detailLevelMs` | query | string |  | Chunk detail level, in milliseconds. Time periods that are shorter than the detail level are discarded. Special value "-1" indicates very large detail level so that all non-infinite chunks are merged into a single chunk ("keepSmallChunks" is ignored in this case). |
| `keepSmallChunks` | query | boolean |  | If specified, standalone chunks smaller than the detail level are not removed from the result. |
| `preciseBounds` | query | boolean |  | If specified, the chunks are precisely cropped to [startTimeMs, endTimeMs]. The default behavior may produce chunks that exceed these bounds. |
| `maxCount` | query | integer |  | Maximum number of chunks to return. |
| `storageLocation` | query | `both` \| `main` \| `backup` |  |  |
| `quality` | query | `both` \| `low` \| `high` |  |  |
| `includeCloudData` | query | boolean |  |  |
| `periodType` | query | `recording` \| `motion` \| `analytics` |  | Chunk type. |
| `motion` | query | array |  | Coordinates in range [0:1]. The format is `{x},{y},{width}x{height}` per each item. Must be used with `periodType` equals to `motion` only. |
| `analytics` | query | string |  | Must be used with `periodType` equals to `analytics` only.</br> `object`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>boundingBox</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Coordinates in range [0..1]. The format is `{x},{y},{width}x{height}`.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>objectTrackId</b> `string($uuid)`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>maxAnalyticsDetailsMs</b> `one of [integer, string]`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Analytic details in milliseconds.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>objectTypeId</b> `string array`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>freeText</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Set of words separated by spaces, commas, etc. The search is done across all attribute</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;values, using wildcards.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>options</b> `string($enum)`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Possible values are:</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`none`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ignoreTextFilter`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ignoreBoundingBox`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ignoreTimePeriod`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>needFullTrack</b> `boolean`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>analyticsEngineId</b> `string($uuid)`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Null value treated as any engine.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>storageId</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Groups data under specified value. I.e., it allows to store multiple independent sets of</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;data in a single DB instead of having to create a separate DB instance for each unique</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;value of the storageId.</br>  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of recorded chunks.
```json
[
  {
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "startTimeMs": 0,
    "durationMs": 0
  }
]
```

---

### GET `/rest/v4/devices/*/footage`

**Get all Devices' footage**

Retrieves the recorded chunks info for all Devices in the Site.

> **Permissions:** View Archive on some Devices.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | query | array |  | Device id(s) to get Footage on. It can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`. MAC address can also be used but it is not supported for certain Devices. |
| `startTimeMs` | query | string |  | Start time of the interval to search for chunks, in milliseconds. |
| `endTimeMs` | query | string |  | End time of the interval to search for chunks, in milliseconds. |
| `detailLevelMs` | query | string |  | Chunk detail level, in milliseconds. Time periods that are shorter than the detail level are discarded. Special value "-1" indicates very large detail level so that all non-infinite chunks are merged into a single chunk ("keepSmallChunks" is ignored in this case). |
| `keepSmallChunks` | query | boolean |  | If specified, standalone chunks smaller than the detail level are not removed from the result. |
| `preciseBounds` | query | boolean |  | If specified, the chunks are precisely cropped to [startTimeMs, endTimeMs]. The default behavior may produce chunks that exceed these bounds. |
| `maxCount` | query | integer |  | Maximum number of chunks to return. |
| `storageLocation` | query | `both` \| `main` \| `backup` |  |  |
| `quality` | query | `both` \| `low` \| `high` |  |  |
| `includeCloudData` | query | boolean |  |  |
| `periodType` | query | `recording` \| `motion` \| `analytics` |  | Chunk type. |
| `motion` | query | array |  | Coordinates in range [0:1]. The format is `{x},{y},{width}x{height}` per each item. Must be used with `periodType` equals to `motion` only. |
| `analytics` | query | string |  | Must be used with `periodType` equals to `analytics` only.</br> `object`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>boundingBox</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Coordinates in range [0..1]. The format is `{x},{y},{width}x{height}`.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>objectTrackId</b> `string($uuid)`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>maxAnalyticsDetailsMs</b> `one of [integer, string]`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Analytic details in milliseconds.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>objectTypeId</b> `string array`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>freeText</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Set of words separated by spaces, commas, etc. The search is done across all attribute</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;values, using wildcards.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>options</b> `string($enum)`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Possible values are:</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`none`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ignoreTextFilter`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ignoreBoundingBox`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ignoreTimePeriod`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>needFullTrack</b> `boolean`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>analyticsEngineId</b> `string($uuid)`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Null value treated as any engine.</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>storageId</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Groups data under specified value. I.e., it allows to store multiple independent sets of</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;data in a single DB instead of having to create a separate DB instance for each unique</br> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;value of the storageId.</br>  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of recorded chunks.
```json
{}
```

---

## Device PTZ

### POST `/rest/v4/devices/{deviceId}/ptz/move`

**Start PTZ move**

Starts a continuous PTZ move.
Supported Device PTZ capabilities can be obtained from "ptz.capabilities" and "ptz.configCapabilities"
fields via `GET /rest/v4/devices`

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "api": "none",
  "pan": 1,
  "tilt": 1,
  "zoom": 1,
  "focus": -1
}
```

**Responses:**

**default**: 

---

### DELETE `/rest/v4/devices/{deviceId}/ptz/move`

**Stop PTZ move**

Stops a continuous PTZ move.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `api` | query | `none` \| `operational` \| `configurational` \| `any` |  | API type to use. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{deviceId}/ptz/position`

**Get Device PTZ position**

Retrieves the Device current position. Returns x, y, and z in the range defined by the
Device.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `type` | query | `absolute` \| `logical` |  | Type of the position to be returned.  Possible values are: - `"absolute"` Absolute position in the range defined by the Device. - `"logical"` Logical position in the range -180 to 180. |
| `api` | query | `none` \| `operational` \| `configurational` \| `any` |  | API type to use. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device position
```json
{
  "api": "none",
  "pan": 1,
  "tilt": 1,
  "zoom": 1
}
```

---

### POST `/rest/v4/devices/{deviceId}/ptz/position`

**Move to absolute PTZ position**

Moves the Device to an absolute position. When the Device reports its PTZ capabilities to
the Server during initialization, the range of position parameters is sent to the Server.
Supported Device PTZ capabilities can be obtained from "ptz.capabilities" and "ptz.configCapabilities"
fields via `GET /rest/v4/devices`

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "type": "absolute",
  "api": "none",
  "pan": 1,
  "tilt": 1,
  "zoom": 1,
  "speed": 0.1
}
```

*Required fields: `speed`*

**Responses:**

**default**: Device position
```json
{
  "deviceId": "string",
  "type": "absolute",
  "api": "none",
  "pan": 1,
  "tilt": 1,
  "zoom": 1,
  "speed": 0.1
}
```

---

### GET `/rest/v4/devices/{deviceId}/ptz/limits`

**Get Device PTZ limits**

Retrieves the Device PTZ limitations.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `type` | query | `absolute` \| `logical` |  | Type of the position to be returned.  Possible values are: - `"absolute"` Absolute position in the range defined by the Device. - `"logical"` Logical position in the range -180 to 180. |
| `api` | query | `none` \| `operational` \| `configurational` \| `any` |  | API type to use. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device position limits
```json
{
  "pan": {
    "min": 0,
    "max": 0
  },
  "tilt": {
    "min": 0,
    "max": 0
  },
  "fov": {
    "min": 0,
    "max": 0
  },
  "rotation": {
    "min": 0,
    "max": 0
  },
  "focus": {
    "min": 0,
    "max": 0
  },
  "panSpeed": {
    "min": 0,
    "max": 0
  },
  "tiltSpeed": {
    "min": 0,
    "max": 0
  },
  "zoomSpeed": {
    "min": 0,
    "max": 0
  },
  "rotationSpeed": {
    "min": 0,
    "max": 0
  },
  "focusSpeed": {
    "min": 0,
    "max": 0
  }
}
```

---

### GET `/rest/v4/devices/{deviceId}/ptz/presets`

**Get PTZ presets**

Retrieves the PTZ preset list.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | query | string |  |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Preset list
```json
[
  {
    "id": "string",
    "deviceId": "string",
    "name": "string"
  }
]
```

---

### POST `/rest/v4/devices/{deviceId}/ptz/presets`

**Create PTZ preset**

Creates a new PTZ preset.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "id": "",
  "name": ""
}
```

*Required fields: `name`*

**Responses:**

**default**: 
```json
{
  "id": "string",
  "deviceId": "string",
  "name": "string"
}
```

---

### PATCH `/rest/v4/devices/{deviceId}/ptz/presets/{id}`

**Update PTZ preset name**

Updates the display name of the specified PTZ preset.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": ""
}
```

*Required fields: `name`*

**Responses:**

**default**: 
```json
{
  "id": "string",
  "deviceId": "string",
  "name": "string"
}
```

---

### DELETE `/rest/v4/devices/{deviceId}/ptz/presets/{id}`

**Delete PTZ preset**

Deletes the specified PTZ preset.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/devices/{deviceId}/ptz/presets/{id}/activate`

**Activate PTZ preset**

Activates the specified PTZ preset.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "speed": 0.1
}
```

*Required fields: `speed`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{deviceId}/ptz/tours`

**Get PTZ Tours**

Retrieves the PTZ Tour list.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id to get PTZ Tours from. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Tour list
```json
[
  {
    "id": "string",
    "deviceId": "string",
    "name": "string",
    "spots": [
      {
        "presetId": "string",
        "stayTimeMs": 1000,
        "speed": 0.1
      }
    ]
  }
]
```

---

### POST `/rest/v4/devices/{deviceId}/ptz/tours`

**Create PTZ Tour**

Creates a new PTZ Tour.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "id": "",
  "name": "",
  "spots": [
    {
      "presetId": "",
      "stayTimeMs": 1000,
      "speed": 0.1
    }
  ]
}
```

*Required fields: `name`, `spots`*

**Responses:**

**default**: 
```json
{
  "id": "string",
  "deviceId": "string",
  "name": "string",
  "spots": [
    {
      "presetId": "string",
      "stayTimeMs": 1000,
      "speed": 0.1
    }
  ]
}
```

---

### DELETE `/rest/v4/devices/{deviceId}/ptz/tours/{id}`

**Delete PTZ Tour**

Deletes the specified PTZ Tour.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{deviceId}/ptz/tours/*/active`

**Get active PTZ Tour**

Retrieves the active PTZ Tour.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | query | string |  |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Active Tour
```json
{
  "id": "string",
  "deviceId": "string",
  "name": "string",
  "spots": [
    {
      "presetId": "string",
      "stayTimeMs": 1000,
      "speed": 0.1
    }
  ]
}
```

---

### POST `/rest/v4/devices/{deviceId}/ptz/tours/{id}/active`

**Activate PTZ Tour**

Activates the specified PTZ Tour.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{}
```

**Responses:**

**default**: 

---

## Virtual Devices

### POST `/rest/v4/devices/*/virtual`

**Create Virtual Device**

Creates a record in the Site for the new virtual Device.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": ""
}
```

**Responses:**

**default**: Device record that was created.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### GET `/rest/v4/devices/*/virtual`

**Get Virtual Devices**

Retrieves a list of virtual Devices.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device information object.
```json
[
  {
    "parameters": {},
    "id": "{00000000-0000-0000-0000-000000000000}",
    "physicalId": "92-61-00-00-00-9F",
    "url": "192.168.0.1",
    "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
    "name": "Device 1",
    "mac": "string",
    "serverId": "{00000000-0000-0000-0000-000000000000}",
    "isManuallyAdded": false,
    "vendor": "string",
    "model": "string",
    "group": {
      "id": "string",
      "name": "Group 1"
    },
    "credentials": {
      "user": "admin",
      "password": "password123"
    },
    "logicalId": "string",
    "options": {
      "isControlEnabled": false,
      "isAudioEnabled": false,
      "isDualStreamingDisabled": false,
      "dewarpingParams": "string",
      "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
      "failoverPriority": "Never",
      "backupQuality": "CameraBackupBoth",
      "backupContentType": "archive",
      "backupPolicy": "byDefault",
      "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
      "bitrateInfos": [
        {}
      ],
      "useBitratePerGop": false,
      "cameraHotspotsEnabled": false,
      "dontRecordSecondaryStream": false,
      "forcedMotionDetection": false,
      "ioOverlayStyle": "Form",
      "motionStream": "primary",
      "ioSettings": [
        {}
      ],
      "mediaPort": 0,
      "hasRtspSettings": false
    },
    "schedule": {
      "isEnabled": false,
      "tasks": [
        {}
      ],
      "minArchiveDays": 0,
      "maxArchiveDays": 0,
      "minArchivePeriodS": 0,
      "maxArchivePeriodS": 0
    },
    "motion": {
      "type": "default",
      "mask": "string",
      "recordBeforeS": 0,
      "recordAfterS": 0
    },
    "status": "Offline",
    "isLicenseUsed": false,
    "capabilities": "noCapabilities",
    "deviceType": "Unknown",
    "compatibleAnalyticsEngineIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "mediaCapabilities": {
      "streamCapabilities": {
        "primary": {},
        "secondary": {}
      },
      "hasDualStreaming": false,
      "hasAudio": false,
      "maxResolution": "string"
    },
    "mediaStreams": [
      {
        "encoderIndex": 0,
        "resolution": "string",
        "transports": "rtsp",
        "transcodingRequired": false,
        "codec": 0
      }
    ],
    "streamUrls": {},
    "userEnabledAnalyticsEngineIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "ptz": {
      "panTiltSensitivity": 1,
      "presetType": "undefined",
      "capabilities": "none",
      "configCapabilities": "none",
      "userModifiableCapabilities": "none",
      "userAddedCapabilities": "none"
    }
  }
]
```

---

### GET `/rest/v4/devices/{id}/virtual`

**Get Virtual Device**

Retrieves a virtual device by id.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices/&ast;/virtual`) or MAC address. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Device information object.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### PATCH `/rest/v4/devices/{id}/virtual`

**Modify Virtual Device**

Modifies a virtual Device by id.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices/&ast;/virtual`) or MAC address. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Device 1",
  "mac": "",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "",
  "model": "",
  "group": {
    "id": "",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "",
        "outputName": "",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": ""
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

**Responses:**

**default**: Device record that was created.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "physicalId": "92-61-00-00-00-9F",
  "url": "192.168.0.1",
  "typeId": "1b7181ce-0227-d3f7-9443-c86aab922d96",
  "name": "Device 1",
  "mac": "string",
  "serverId": "{00000000-0000-0000-0000-000000000000}",
  "isManuallyAdded": false,
  "vendor": "string",
  "model": "string",
  "group": {
    "id": "string",
    "name": "Group 1"
  },
  "credentials": {
    "user": "admin",
    "password": "password123"
  },
  "logicalId": "string",
  "options": {
    "isControlEnabled": false,
    "isAudioEnabled": false,
    "isDualStreamingDisabled": false,
    "dewarpingParams": "string",
    "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
    "failoverPriority": "Never",
    "backupQuality": "CameraBackupBoth",
    "backupContentType": "archive",
    "backupPolicy": "byDefault",
    "audioOutputDeviceId": "{00000000-0000-0000-0000-000000000000}",
    "bitrateInfos": [
      {
        "encoderIndex": "primary",
        "timestampMs": 0,
        "rawSuggestedBitrate": 0,
        "suggestedBitrate": 0,
        "actualBitrate": 0,
        "bitratePerGop": false,
        "bitrateFactor": 0,
        "fps": 0,
        "actualFps": 0,
        "averageGopSize": 0,
        "resolution": "string",
        "numberOfChannels": 0,
        "isConfigured": false,
        "avarageBitrateMbps": 0
      }
    ],
    "useBitratePerGop": false,
    "cameraHotspotsEnabled": false,
    "dontRecordSecondaryStream": false,
    "forcedMotionDetection": false,
    "ioOverlayStyle": "Form",
    "motionStream": "primary",
    "ioSettings": [
      {
        "id": "string",
        "portType": "unknown",
        "supportedPortTypes": "unknown",
        "inputName": "string",
        "outputName": "string",
        "iDefaultState": "open_circuit",
        "oDefaultState": "open_circuit",
        "autoResetTimeoutMs": 0
      }
    ],
    "mediaPort": 0,
    "hasRtspSettings": false
  },
  "schedule": {
    "isEnabled": false,
    "tasks": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0,
        "recordingType": "always",
        "streamQuality": "lowest",
        "fps": 0,
        "bitrateKbps": 0,
        "metadataTypes": "none"
      }
    ],
    "minArchiveDays": 0,
    "maxArchiveDays": 0,
    "minArchivePeriodS": 0,
    "maxArchivePeriodS": 0
  },
  "motion": {
    "type": "default",
    "mask": "string",
    "recordBeforeS": 0,
    "recordAfterS": 0
  },
  "status": "Offline",
  "isLicenseUsed": false,
  "capabilities": "noCapabilities",
  "deviceType": "Unknown",
  "compatibleAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "mediaCapabilities": {
    "streamCapabilities": {
      "primary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      },
      "secondary": {
        "minBitrateKbps": 0,
        "maxBitrateKbps": 0,
        "defaultBitrateKbps": 0,
        "defaultFps": 0,
        "maxFps": 0
      }
    },
    "hasDualStreaming": false,
    "hasAudio": false,
    "maxResolution": "string"
  },
  "mediaStreams": [
    {
      "encoderIndex": 0,
      "resolution": "string",
      "transports": "rtsp",
      "transcodingRequired": false,
      "codec": 0
    }
  ],
  "streamUrls": {},
  "userEnabledAnalyticsEngineIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "ptz": {
    "panTiltSensitivity": 1,
    "presetType": "undefined",
    "capabilities": "none",
    "configCapabilities": "none",
    "userModifiableCapabilities": "none",
    "userAddedCapabilities": "none"
  }
}
```

---

### DELETE `/rest/v4/devices/{id}/virtual`

**Delete Virtual Device**

Deletes a virtual Device by id.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices/&ast;/virtual`) or MAC address. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/devices/{id}/virtual/status`

**Get virtual Device status**

Returns virtual Device status.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual Device id, can be obtained from "id" field via <code>GET /rest/v4/devices/&ast;/virtual</code>. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Virtual Device status.
```json
{
  "id": "string",
  "lockInfo": {
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "token": "{00000000-0000-0000-0000-000000000000}",
    "ttlMs": 0,
    "progress": 0
  }
}
```

---

### PATCH `/rest/v4/devices/{id}/virtual/prepare`

**Virtual Device preparation**

Returns Device footage preparation result.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual Device id, can be obtained from "id" field via <code>GET /rest/v4/devices/&ast;/virtual</code>. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "footage": [
    {
      "sizeB": 4096,
      "startTimeMs": 0,
      "durationMs": 60000
    }
  ]
}
```

**Responses:**

**default**: Virtual Device status.
```json
{
  "id": "string",
  "lockInfo": {
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "token": "{00000000-0000-0000-0000-000000000000}",
    "ttlMs": 0,
    "progress": 0
  }
}
```

---

### PATCH `/rest/v4/devices/{id}/virtual/consume`

**Start Virtual Device Consume**

Starts a consume operation, importing already uploaded file as camera footage.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual Device id, can be obtained from "id" field via <code>GET /rest/v4/devices/&ast;/virtual</code>. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "token": "89abcdef-0123-4567-89ab-cdef01234567",
  "uploadId": "",
  "startTimeMs": 0
}
```

*Required fields: `token`, `uploadId`, `startTimeMs`*

**Responses:**

**default**: Virtual device status.
```json
{
  "id": "string",
  "lockInfo": {
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "token": "{00000000-0000-0000-0000-000000000000}",
    "ttlMs": 0,
    "progress": 0
  }
}
```

---

### PATCH `/rest/v4/devices/{id}/virtual/lock`

**Lock Virtual Device**

Locks virtual device.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual Device id, can be obtained from "id" field via <code>GET /rest/v4/devices/&ast;/virtual</code>. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "ttlMs": 60000,
  "userId": "{00000000-0000-0000-0000-000000000000}"
}
```

*Required fields: `ttlMs`*

**Responses:**

**default**: Virtual device status.
```json
{
  "id": "string",
  "lockInfo": {
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "token": "{00000000-0000-0000-0000-000000000000}",
    "ttlMs": 0,
    "progress": 0
  }
}
```

---

### PATCH `/rest/v4/devices/{id}/virtual/extend`

**Extend Virtual Device Lock**

Extends virtual device lock.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual Device id, can be obtained from "id" field via <code>GET /rest/v4/devices/&ast;/virtual</code>. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "ttlMs": 60000,
  "userId": "{00000000-0000-0000-0000-000000000000}",
  "token": "89abcdef-0123-4567-89ab-cdef01234567"
}
```

*Required fields: `ttlMs`, `token`*

**Responses:**

**default**: Virtual device status.
```json
{
  "id": "string",
  "lockInfo": {
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "token": "{00000000-0000-0000-0000-000000000000}",
    "ttlMs": 0,
    "progress": 0
  }
}
```

---

### PATCH `/rest/v4/devices/{id}/virtual/release`

**Release Virtual Device Lock**

Releases virtual device lock.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Virtual Device id, can be obtained from "id" field via <code>GET /rest/v4/devices/&ast;/virtual</code>. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "token": "89abcdef-0123-4567-89ab-cdef01234567"
}
```

*Required fields: `token`*

**Responses:**

**default**: Virtual device status.
```json
{
  "id": "string",
  "lockInfo": {
    "userId": "{00000000-0000-0000-0000-000000000000}",
    "token": "{00000000-0000-0000-0000-000000000000}",
    "ttlMs": 0,
    "progress": 0
  }
}
```

---

## Users

### GET `/rest/v4/users`

**Get Users**

Retrieves all User records stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all User records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "admin",
    "email": "string",
    "type": "local",
    "fullName": "string",
    "locale": "en_US",
    "isEnabled": false,
    "isHttpDigestEnabled": false,
    "externalId": {
      "dn": "string",
      "syncId": "string",
      "synced": false
    },
    "parameters": {},
    "groupIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "orgGroupIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "permissions": "none",
    "temporaryToken": {
      "startS": 1689273703,
      "endS": 1689273704,
      "expiresAfterLoginS": 10000,
      "token": "string"
    },
    "attributes": "readonly",
    "account2faEnabled": false,
    "settings": {
      "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
      "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
    }
  }
]
```

---

### POST `/rest/v4/users`

**Create User**

Creates a record in the Site for the new User.

> **Permissions:** Power User with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "admin",
  "email": "",
  "type": "local",
  "fullName": "",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "password": "",
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": ""
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

*Required fields: `name`*

**Responses:**

**default**: User record that was created.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "admin",
  "email": "string",
  "type": "local",
  "fullName": "string",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": "string"
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

---

### GET `/rest/v4/users/{id}`

**Get User**

Retrieves the specified User record stored in the Site.

> **Permissions:** Power User or the user themselves.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | User id or url-encoded name (can be obtained from "id" or "name" fields via `GET /rest/v4/users`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: User record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "admin",
  "email": "string",
  "type": "local",
  "fullName": "string",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": "string"
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

---

### PUT `/rest/v4/users/{id}`

**Replace User**

Replaces all fields of the specified User record stored in the Site.

> **Permissions:** Power User or the user themselves with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | User id or url-encoded name (can be obtained from "id" or "name" fields via `GET /rest/v4/users`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "admin",
  "email": "",
  "type": "local",
  "fullName": "",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "password": "",
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": ""
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

*Required fields: `name`*

**Responses:**

**default**: User record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "admin",
  "email": "string",
  "type": "local",
  "fullName": "string",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": "string"
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

---

### PATCH `/rest/v4/users/{id}`

**Modify User**

Modifies certain fields of the specified User record stored in the Site.

> **Permissions:** Power User or the user themselves with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | User id or url-encoded name (can be obtained from "id" or "name" fields via `GET /rest/v4/users`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "admin",
  "email": "",
  "fullName": "",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "password": "",
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": ""
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

**Responses:**

**default**: User record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "admin",
  "email": "string",
  "type": "local",
  "fullName": "string",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": "string"
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

---

### DELETE `/rest/v4/users/{id}`

**Delete User**

Deletes the specified User record from the Site.

> **Permissions:** Power User or the user themselves with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | User id or url-encoded name (can be obtained from "id" or "name" fields via `GET /rest/v4/users`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/users/{id}/permissions`

**Get User Permissions**

> **Permissions:** All Users can see own permissions, Power Users can see everything.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | User id or name (can be obtained from `/rest/v4/users`). Use "-" for the Current User. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Inherited groups and effective permissions.
```json
{
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none"
}
```

---

## User Groups

### GET `/rest/v4/userGroups`

**Get User Groups**

Retrieves all User Group records stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all User Group records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "User Group 1",
    "description": "string",
    "type": "local",
    "externalId": {
      "dn": "string",
      "syncId": "string",
      "synced": false
    },
    "permissions": "none",
    "parentGroupIds": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "attributes": "readonly"
  }
]
```

---

### POST `/rest/v4/userGroups`

**Create User Group**

Creates a record in the Site for the new User Group.

> **Permissions:** Power User with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "User Group 1",
  "description": "",
  "type": "local",
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

*Required fields: `name`*

**Responses:**

**default**: User Group record that was created.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "User Group 1",
  "description": "string",
  "type": "local",
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

---

### GET `/rest/v4/userGroups/{id}`

**Get User Group**

Retrieves the specified User Group record stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | User Group id (can be obtained from "id" field via `GET /rest/v4/userGroups`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: User Group record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "User Group 1",
  "description": "string",
  "type": "local",
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

---

### PUT `/rest/v4/userGroups/{id}`

**Replace User Group**

Replaces all fields of the specified User Group record stored in the Site.

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | User Group id (can be obtained from "id" field via `GET /rest/v4/userGroups`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "User Group 1",
  "description": "",
  "type": "local",
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

*Required fields: `name`*

**Responses:**

**default**: User Group record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "User Group 1",
  "description": "string",
  "type": "local",
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

---

### PATCH `/rest/v4/userGroups/{id}`

**Modify User Group**

Modifies certain fields of the specified User Group record stored in the Site.

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | User Group id (can be obtained from "id" field via `GET /rest/v4/userGroups`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "User Group 1",
  "description": "",
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

**Responses:**

**default**: User Group record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "User Group 1",
  "description": "string",
  "type": "local",
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "permissions": "none",
  "parentGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "attributes": "readonly"
}
```

---

### DELETE `/rest/v4/userGroups/{id}`

**Delete User Group**

Deletes the specified User Group record from the Site.

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | User Group id (can be obtained from "id" field via `GET /rest/v4/userGroups`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/userGroups/{id}/permissions`

**Get User Group Permissions**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | User Group id (can be obtained from `/rest/v4/userGroups`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Inherited groups and effective permissions.
```json
{
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none"
}
```

---

## Licenses

### GET `/rest/v4/licenses`

**Get Licenses**

Retrieves all License records stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all License records.
```json
[
  {
    "key": "string",
    "licenseBlock": "string"
  }
]
```

---

### GET `/rest/v4/licenses/{key}`

**Get License**

Retrieves the specified License record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `key` | path | string | ✓ | License key (existing key can be obtained from "key" field via `GET /rest/v4/licenses`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: License record.
```json
{
  "key": "string",
  "licenseBlock": "string"
}
```

---

### PUT `/rest/v4/licenses/{key}`

**Create License**

Creates a record about the License and activates it with the data provided by the VMS
license server if `licenseBlock` is unspecified. If `licenseBlock` is specified, creates a
License with the data provided.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `key` | path | string | ✓ | License serial number. Corresponds to the License Block SERIAL property. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "licenseBlock": ""
}
```

**Responses:**

**default**: License record.
```json
{
  "key": "string",
  "licenseBlock": "string"
}
```

---

### DELETE `/rest/v4/licenses/{key}`

**Delete License**

Deletes the specified License record from the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `key` | path | string | ✓ | License key (existing key can be obtained from "key" field via `GET /rest/v4/licenses`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/licenses/*/summary`

**Get license usage info**

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: License summary information per license
class name.
```json
{}
```

---

## Layouts

### GET `/rest/v4/layouts`

**Get Layouts**

Retrieves all Layout records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Layout records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "parentId": "{00000000-0000-0000-0000-000000000000}",
    "name": "Layout",
    "cellAspectRatio": 0,
    "cellSpacing": 0,
    "items": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "flags": 0,
        "left": 0,
        "top": 0,
        "right": 1,
        "bottom": 1,
        "rotation": 0,
        "resourceId": "{00000000-0000-0000-0000-000000000000}",
        "resourcePath": "string",
        "zoomLeft": 0,
        "zoomTop": 0,
        "zoomRight": 0,
        "zoomBottom": 0,
        "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
        "contrastParams": {},
        "dewarpingParams": {},
        "displayInfo": false,
        "controlPtz": false,
        "displayAnalyticsObjects": false,
        "displayRoi": false,
        "displayHotspots": false
      }
    ],
    "locked": false,
    "fixedWidth": 1,
    "fixedHeight": 1,
    "logicalId": 0,
    "backgroundImageFilename": "string",
    "backgroundWidth": 0,
    "backgroundHeight": 0,
    "backgroundOpacity": 0
  }
]
```

---

### POST `/rest/v4/layouts`

**Create Layout**

Creates a record in the Site about the new Layout.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "89abcdef-0123-4567-89ab-cdef01234567",
      "resourcePath": "",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

*Required fields: `name`, `items`, `fixedWidth`, `fixedHeight`*

**Responses:**

**default**: Layout record that was created.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "resourcePath": "string",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "string",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

---

### GET `/rest/v4/layouts/{id}`

**Get Layout**

Retrieves the specified Layout record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Layout unique id or logical id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Layout record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "resourcePath": "string",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "string",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

---

### PUT `/rest/v4/layouts/{id}`

**Replace Layout**

Replaces all fields of the specified Layout record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Layout unique id or logical id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "89abcdef-0123-4567-89ab-cdef01234567",
      "resourcePath": "",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

*Required fields: `name`, `items`, `fixedWidth`, `fixedHeight`*

**Responses:**

**default**: Layout record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "resourcePath": "string",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "string",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

---

### PATCH `/rest/v4/layouts/{id}`

**Modify Layout**

Modifies certain fields of the specified Layout record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Layout unique id or logical id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "resourcePath": "",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

**Responses:**

**default**: Layout record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Layout",
  "cellAspectRatio": 0,
  "cellSpacing": 0,
  "items": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "flags": 0,
      "left": 0,
      "top": 0,
      "right": 1,
      "bottom": 1,
      "rotation": 0,
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "resourcePath": "string",
      "zoomLeft": 0,
      "zoomTop": 0,
      "zoomRight": 0,
      "zoomBottom": 0,
      "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
      "contrastParams": {
        "enabled": false,
        "blackLevel": 0,
        "whiteLevel": 0,
        "gamma": 0
      },
      "dewarpingParams": {
        "enabled": false,
        "xAngle": 0,
        "yAngle": 0,
        "fov": 0,
        "panoFactor": 0
      },
      "displayInfo": false,
      "controlPtz": false,
      "displayAnalyticsObjects": false,
      "displayRoi": false,
      "displayHotspots": false
    }
  ],
  "locked": false,
  "fixedWidth": 1,
  "fixedHeight": 1,
  "logicalId": 0,
  "backgroundImageFilename": "string",
  "backgroundWidth": 0,
  "backgroundHeight": 0,
  "backgroundOpacity": 0
}
```

---

### DELETE `/rest/v4/layouts/{id}`

**Delete Layout**

Deletes the specified Layout record from the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Layout unique id or logical id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/layouts/{layoutId}/items`

**Get Layout Items**

Retrieves all Layout Items for the specified Layout record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `layoutId` | path | string | ✓ | Layout unique id or logical id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Layout Items.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "flags": 0,
    "left": 0,
    "top": 0,
    "right": 1,
    "bottom": 1,
    "rotation": 0,
    "resourceId": "{00000000-0000-0000-0000-000000000000}",
    "resourcePath": "string",
    "zoomLeft": 0,
    "zoomTop": 0,
    "zoomRight": 0,
    "zoomBottom": 0,
    "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
    "contrastParams": {
      "enabled": false,
      "blackLevel": 0,
      "whiteLevel": 0,
      "gamma": 0
    },
    "dewarpingParams": {
      "enabled": false,
      "xAngle": 0,
      "yAngle": 0,
      "fov": 0,
      "panoFactor": 0
    },
    "displayInfo": false,
    "controlPtz": false,
    "displayAnalyticsObjects": false,
    "displayRoi": false,
    "displayHotspots": false,
    "layoutId": "{00000000-0000-0000-0000-000000000000}"
  }
]
```

---

### POST `/rest/v4/layouts/{layoutId}/items`

**Add Layout Item to Layout**

Adds a new Layout Item record to the specified Layout stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `layoutId` | path | string | ✓ | Layout unique id or logical id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "89abcdef-0123-4567-89ab-cdef01234567",
  "resourcePath": "",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false
}
```

*Required fields: `left`, `top`, `right`, `bottom`, `resourceId`*

**Responses:**

**default**: Layout Item.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "{00000000-0000-0000-0000-000000000000}",
  "resourcePath": "string",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false,
  "layoutId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### GET `/rest/v4/layouts/{layoutId}/items/{id}`

**Get Layout Item**

Retrieves the specified Layout Item for the specified Layout record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Layout Item unique id. |
| `layoutId` | path | string | ✓ | Layout unique id or logical id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Layout Item.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "{00000000-0000-0000-0000-000000000000}",
  "resourcePath": "string",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false,
  "layoutId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### PUT `/rest/v4/layouts/{layoutId}/items/{id}`

**Replace Layout Item**

Replaces all fields of the specified Layout Item for the specified Layout record stored
in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Layout Item unique id. |
| `layoutId` | path | string | ✓ | Layout unique id or logical id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "89abcdef-0123-4567-89ab-cdef01234567",
  "resourcePath": "",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false
}
```

*Required fields: `left`, `top`, `right`, `bottom`, `resourceId`*

**Responses:**

**default**: Layout Item.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "{00000000-0000-0000-0000-000000000000}",
  "resourcePath": "string",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false,
  "layoutId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### PATCH `/rest/v4/layouts/{layoutId}/items/{id}`

**Modify Layout Item**

Modifies certain fields of the specified Layout Item for the specified Layout record
stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Layout Item unique id. |
| `layoutId` | path | string | ✓ | Layout unique id or logical id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "{00000000-0000-0000-0000-000000000000}",
  "resourcePath": "",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false
}
```

**Responses:**

**default**: Layout Item.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "flags": 0,
  "left": 0,
  "top": 0,
  "right": 1,
  "bottom": 1,
  "rotation": 0,
  "resourceId": "{00000000-0000-0000-0000-000000000000}",
  "resourcePath": "string",
  "zoomLeft": 0,
  "zoomTop": 0,
  "zoomRight": 0,
  "zoomBottom": 0,
  "zoomTargetId": "{00000000-0000-0000-0000-000000000000}",
  "contrastParams": {
    "enabled": false,
    "blackLevel": 0,
    "whiteLevel": 0,
    "gamma": 0
  },
  "dewarpingParams": {
    "enabled": false,
    "xAngle": 0,
    "yAngle": 0,
    "fov": 0,
    "panoFactor": 0
  },
  "displayInfo": false,
  "controlPtz": false,
  "displayAnalyticsObjects": false,
  "displayRoi": false,
  "displayHotspots": false,
  "layoutId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### DELETE `/rest/v4/layouts/{layoutId}/items/{id}`

**Delete Layout Item**

Deletes the specified Layout Item for the specified Layout record from the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Layout Item unique id. |
| `layoutId` | path | string | ✓ | Layout unique id or logical id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Showreels

### GET `/rest/v4/showreels`

**Get Showreels**

Retrieves all Showreel records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Showreel records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "parentId": "{00000000-0000-0000-0000-000000000000}",
    "name": "Showreel",
    "items": [
      {
        "resourceId": "{00000000-0000-0000-0000-000000000000}",
        "delayMs": 0
      }
    ],
    "settings": {
      "manual": false
    }
  }
]
```

---

### POST `/rest/v4/showreels`

**Create Showreel**

Creates a record in the Site for the new Showreel.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "89abcdef-0123-4567-89ab-cdef01234567",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "89abcdef-0123-4567-89ab-cdef01234567",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

*Required fields: `parentId`, `name`, `items`, `settings`*

**Responses:**

**default**: Showreel record that was created.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

---

### GET `/rest/v4/showreels/{id}`

**Get Showreel**

Retrieves the specified Showreel record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Showreel unique id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Showreel record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

---

### PUT `/rest/v4/showreels/{id}`

**Replace Showreel**

Replaces all fields of the specified Showreel record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Showreel unique id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "89abcdef-0123-4567-89ab-cdef01234567",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "89abcdef-0123-4567-89ab-cdef01234567",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

*Required fields: `parentId`, `name`, `items`, `settings`*

**Responses:**

**default**: Showreel record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

---

### PATCH `/rest/v4/showreels/{id}`

**Modify Showreel**

Modifies certain fields of the specified Showreel record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Showreel unique id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

**Responses:**

**default**: Showreel record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Showreel",
  "items": [
    {
      "resourceId": "{00000000-0000-0000-0000-000000000000}",
      "delayMs": 0
    }
  ],
  "settings": {
    "manual": false
  }
}
```

---

### DELETE `/rest/v4/showreels/{id}`

**Delete Showreel**

Deletes the specified Showreel record from the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Showreel unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Lookup Lists

### GET `/rest/v4/lookupLists`

**Get Lookup Lists**

Retrieves Lookup List records stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Lookup List records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "Parking Allow-list",
    "objectTypeId": "nx.base.Vehicle",
    "attributeNames": "[\"Color\", \"License Plate.Number\"]",
    "entries": [
      {
        "Color": "red"
      },
      {
        "License Plate.Number": "AA000A"
      },
      {
        "Color": "blue",
        "License Plate.Number": "BB777B"
      }
    ]
  }
]
```

---

### POST `/rest/v4/lookupLists`

**Create Lookup List**

Creates a record in the Site for the new Lookup List.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

*Required fields: `name`, `objectTypeId`, `attributeNames`, `entries`*

**Responses:**

**default**: Lookup List record that was created.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

---

### GET `/rest/v4/lookupLists/{id}`

**Get Lookup List**

Retrieves the specified Lookup List record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Lookup List unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Lookup List record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

---

### PUT `/rest/v4/lookupLists/{id}`

**Replace Lookup List**

Replaces all fields of the specified Lookup List record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Lookup List unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

*Required fields: `name`, `objectTypeId`, `attributeNames`, `entries`*

**Responses:**

**default**: Lookup List record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

---

### PATCH `/rest/v4/lookupLists/{id}`

**Modify Lookup List**

Modifies certain fields of the specified Lookup List record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Lookup List unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

**Responses:**

**default**: Lookup List record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "Parking Allow-list",
  "objectTypeId": "nx.base.Vehicle",
  "attributeNames": "[\"Color\", \"License Plate.Number\"]",
  "entries": [
    {
      "Color": "red"
    },
    {
      "License Plate.Number": "AA000A"
    },
    {
      "Color": "blue",
      "License Plate.Number": "BB777B"
    }
  ]
}
```

---

### DELETE `/rest/v4/lookupLists/{id}`

**Delete Lookup List**

Deletes the specified Lookup List record from the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Lookup List unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Video Walls

### GET `/rest/v4/videoWalls`

**Get Video Walls**

Retrieves all Video Wall records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Video Wall records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "parentId": "{00000000-0000-0000-0000-000000000000}",
    "name": "Video wall",
    "typeId": "{00000000-0000-0000-0000-000000000000}",
    "autorun": false,
    "timeline": false,
    "items": [
      {
        "guid": "{00000000-0000-0000-0000-000000000000}",
        "pcGuid": "{00000000-0000-0000-0000-000000000000}",
        "layoutGuid": "{00000000-0000-0000-0000-000000000000}",
        "name": "Video Wall item 1",
        "snapLeft": 0,
        "snapTop": 0,
        "snapRight": 0,
        "snapBottom": 0
      }
    ],
    "screens": [
      {
        "pcGuid": "{00000000-0000-0000-0000-000000000000}",
        "pcIndex": 0,
        "desktopLeft": 0,
        "desktopTop": 0,
        "desktopWidth": 0,
        "desktopHeight": 0,
        "layoutLeft": 0,
        "layoutTop": 0,
        "layoutWidth": 0,
        "layoutHeight": 0
      }
    ],
    "matrices": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "name": "Video Wall matrix 1",
        "items": []
      }
    ]
  }
]
```

---

### POST `/rest/v4/videoWalls`

**Create Video Wall**

Creates a record in the Site for the new Video Wall.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "89abcdef-0123-4567-89ab-cdef01234567",
      "pcGuid": "89abcdef-0123-4567-89ab-cdef01234567",
      "layoutGuid": "89abcdef-0123-4567-89ab-cdef01234567",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "89abcdef-0123-4567-89ab-cdef01234567",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "89abcdef-0123-4567-89ab-cdef01234567",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

*Required fields: `name`, `items`, `screens`, `matrices`*

**Responses:**

**default**: Video Wall record that was created.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "{00000000-0000-0000-0000-000000000000}",
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "layoutGuid": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

---

### GET `/rest/v4/videoWalls/{id}`

**Get Video Wall**

Retrieves the specified Video Wall record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Video Wall unique id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Video Wall record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "{00000000-0000-0000-0000-000000000000}",
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "layoutGuid": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

---

### PUT `/rest/v4/videoWalls/{id}`

**Replace Video Wall**

Replaces all fields of the specified Video Wall record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Video Wall unique id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "89abcdef-0123-4567-89ab-cdef01234567",
      "pcGuid": "89abcdef-0123-4567-89ab-cdef01234567",
      "layoutGuid": "89abcdef-0123-4567-89ab-cdef01234567",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "89abcdef-0123-4567-89ab-cdef01234567",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "89abcdef-0123-4567-89ab-cdef01234567",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

*Required fields: `name`, `items`, `screens`, `matrices`*

**Responses:**

**default**: Video Wall record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "{00000000-0000-0000-0000-000000000000}",
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "layoutGuid": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

---

### PATCH `/rest/v4/videoWalls/{id}`

**Modify Video Wall**

Modifies certain fields of the specified Video Wall record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Video Wall unique id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "{00000000-0000-0000-0000-000000000000}",
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "layoutGuid": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

**Responses:**

**default**: Video Wall record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Video wall",
  "typeId": "{00000000-0000-0000-0000-000000000000}",
  "autorun": false,
  "timeline": false,
  "items": [
    {
      "guid": "{00000000-0000-0000-0000-000000000000}",
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "layoutGuid": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall item 1",
      "snapLeft": 0,
      "snapTop": 0,
      "snapRight": 0,
      "snapBottom": 0
    }
  ],
  "screens": [
    {
      "pcGuid": "{00000000-0000-0000-0000-000000000000}",
      "pcIndex": 0,
      "desktopLeft": 0,
      "desktopTop": 0,
      "desktopWidth": 0,
      "desktopHeight": 0,
      "layoutLeft": 0,
      "layoutTop": 0,
      "layoutWidth": 0,
      "layoutHeight": 0
    }
  ],
  "matrices": [
    {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "name": "Video Wall matrix 1",
      "items": [
        {}
      ]
    }
  ]
}
```

---

### DELETE `/rest/v4/videoWalls/{id}`

**Delete Video Wall**

Deletes the specified Video Wall record from the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Video Wall unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Stored Files

### GET `/rest/v4/storedFiles`

**Get Stored Files**

Retrieves all Stored File records stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Stored File records.
```json
[
  {
    "path": "string",
    "data": "string"
  }
]
```

---

### GET `/rest/v4/storedFiles/{path}`

**Get Stored File**

Retrieves the specified Stored File record stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | path | string | ✓ | Stored File path (can be obtained from `path` field via `GET /rest/v4/storedFiles`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Stored File record.
```json
{
  "path": "string",
  "data": "string"
}
```

---

### PUT `/rest/v4/storedFiles/{path}`

**Save Stored File**

Creates or replaces a record in the Site about the new or already existing Stored File.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | path | string | ✓ | Stored File path (can be obtained from `path` field via `GET /rest/v4/storedFiles`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "data": ""
}
```

*Required fields: `data`*

**Responses:**

**default**: Stored File record.
```json
{
  "path": "string",
  "data": "string"
}
```

---

### DELETE `/rest/v4/storedFiles/{path}`

**Delete Stored File**

Deletes the specified Stored File record from the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | path | string | ✓ | Stored File path (can be obtained from `path` field via `GET /rest/v4/storedFiles`). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Web Pages

### GET `/rest/v4/webPages`

**Get Web Pages**

Retrieves all Web Page records stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Web Page records.
```json
[
  {
    "parameters": {},
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "string",
    "url": "string",
    "parentId": "{00000000-0000-0000-0000-000000000000}",
    "certificateCheck": false,
    "proxyDomainAllowList": [
      "string"
    ]
  }
]
```

---

### POST `/rest/v4/webPages`

**Create Web Page**

Creates a record in the Site for the new Web Page.

> **Permissions:** Depends on Resource access rights.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "",
  "url": "",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    ""
  ]
}
```

*Required fields: `name`, `url`, `proxyDomainAllowList`*

**Responses:**

**default**: Web Page record that was created.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "string",
  "url": "string",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    "string"
  ]
}
```

---

### GET `/rest/v4/webPages/{id}`

**Get Web Page**

Retrieves the specified Web Page record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Web Page unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Web Page record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "string",
  "url": "string",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    "string"
  ]
}
```

---

### PUT `/rest/v4/webPages/{id}`

**Replace Web Page**

Replaces all fields of the specified Web Page record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Web Page unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "",
  "url": "",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    ""
  ]
}
```

*Required fields: `name`, `url`, `proxyDomainAllowList`*

**Responses:**

**default**: Web Page record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "string",
  "url": "string",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    "string"
  ]
}
```

---

### PATCH `/rest/v4/webPages/{id}`

**Modify Web Page**

Modifies certain fields of the specified Web Page record stored in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Web Page unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "parameters": {},
  "name": "",
  "url": "",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    ""
  ]
}
```

**Responses:**

**default**: Web Page record.
```json
{
  "parameters": {},
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "string",
  "url": "string",
  "parentId": "{00000000-0000-0000-0000-000000000000}",
  "certificateCheck": false,
  "proxyDomainAllowList": [
    "string"
  ]
}
```

---

### DELETE `/rest/v4/webPages/{id}`

**Delete Web Page**

Deletes the specified Web Page record from the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Web Page unique id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Events

### GET `/rest/v4/events/manifest/events`

**Get Event manifest**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{}
```

---

### GET `/rest/v4/events/manifest/actions`

**Get Action manifest**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{}
```

---

### GET `/rest/v4/events/log`

**Get Event Log**

Read Event Log from all Servers.

> **Permissions:** Event log and audit trail view.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `startTimeMs` | query | string |  | Start time in milliseconds. |
| `durationMs` | query | string |  | Duration in milliseconds. Not presented for a video chunk that is currently being recorded. |
| `eventResourceId` | query | array |  | List of event resource flexible ids. |
| `eventType` | query | array |  | List of event types. See /rest/v4/events/manifest/events for event manifests with possible event types. |
| `eventSubtype` | query | string |  | Event subtype, for advanced analytics event filtering. Analytics event type for 'Analytics event'. Analytics object type for 'Analytics object detected' event. See analytics taxonomy for the reference values. |
| `actionType` | query | array |  | List of action types. See /rest/v4/events/manifest/actions for action manifests with possible action types. |
| `ruleId` | query | string(uuid) |  | VMS Rule id. |
| `text` | query | string |  | Event description lookup string. |
| `eventsOnly` | query | boolean |  | Read event data only. |
| `order` | query | `asc` \| `desc` |  | Event log record sort order. |
| `limit` | query | string |  | Event log record limit, zero value is no limit. |
| `flags` | query | `noFlags` \| `acknowledge` \| `videoLinkExists` |  | Event log record required flags.  Possible values are one of or the combination by `\|` of the following: - `"noFlags"` - `"acknowledge"` The notification requires user acknowledge. - `"videoLinkExists"` There is recording archive exists for the time and device of the event. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Server event log.
```json
[
  {
    "timestampMs": 0,
    "eventData": {},
    "actionData": {},
    "aggregatedInfo": {
      "total": 0,
      "firstEventsData": [],
      "lastEventsData": []
    },
    "ruleId": "{00000000-0000-0000-0000-000000000000}",
    "flags": "noFlags"
  }
]
```

---

### GET `/rest/v4/events/log/{serverId}`

**Get Event Log**

Read Event Log from single Server.

> **Permissions:** Event log and audit trail view.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | path | string | ✓ | Server id. Can be obtained from "id" field via `GET /rest/v4/servers`, or be `this` to refer to the current Server. |
| `startTimeMs` | query | string |  | Start time in milliseconds. |
| `durationMs` | query | string |  | Duration in milliseconds. Not presented for a video chunk that is currently being recorded. |
| `eventResourceId` | query | array |  | List of event resource flexible ids. |
| `eventType` | query | array |  | List of event types. See /rest/v4/events/manifest/events for event manifests with possible event types. |
| `eventSubtype` | query | string |  | Event subtype, for advanced analytics event filtering. Analytics event type for 'Analytics event'. Analytics object type for 'Analytics object detected' event. See analytics taxonomy for the reference values. |
| `actionType` | query | array |  | List of action types. See /rest/v4/events/manifest/actions for action manifests with possible action types. |
| `ruleId` | query | string(uuid) |  | VMS Rule id. |
| `text` | query | string |  | Event description lookup string. |
| `eventsOnly` | query | boolean |  | Read event data only. |
| `order` | query | `asc` \| `desc` |  | Event log record sort order. |
| `limit` | query | string |  | Event log record limit, zero value is no limit. |
| `flags` | query | `noFlags` \| `acknowledge` \| `videoLinkExists` |  | Event log record required flags.  Possible values are one of or the combination by `\|` of the following: - `"noFlags"` - `"acknowledge"` The notification requires user acknowledge. - `"videoLinkExists"` There is recording archive exists for the time and device of the event. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Server event log.
```json
[
  {
    "timestampMs": 0,
    "eventData": {},
    "actionData": {},
    "aggregatedInfo": {
      "total": 0,
      "firstEventsData": [],
      "lastEventsData": []
    },
    "ruleId": "{00000000-0000-0000-0000-000000000000}",
    "flags": "noFlags"
  }
]
```

---

### GET `/rest/v4/events/acknowledges`

**Notifications to acknowledge**

Retrieves notifications to acknowledge for the given user.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Notifications to acknowledge
```json
[
  {
    "timestampMs": 0,
    "eventData": {},
    "actionData": {},
    "aggregatedInfo": {
      "total": 0,
      "firstEventsData": [],
      "lastEventsData": []
    },
    "ruleId": "{00000000-0000-0000-0000-000000000000}",
    "flags": "noFlags"
  }
]
```

---

### POST `/rest/v4/events/acknowledges`

**Acknowledge Event notification**

Marks event as acknowledged and creates corresponding bookmark.

> **Permissions:** Target user for the event, permission to add bookmark for the device.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "deviceId": "89abcdef-0123-4567-89ab-cdef01234567",
  "name": "Bookmark",
  "description": "",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    ""
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "creationTimeMs": 0,
  "actionId": "89abcdef-0123-4567-89ab-cdef01234567",
  "actionServerId": "89abcdef-0123-4567-89ab-cdef01234567"
}
```

*Required fields: `deviceId`, `name`, `durationMs`, `actionId`, `actionServerId`*

**Responses:**

**default**: Created bookmark data
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "name": "Bookmark",
  "description": "string",
  "startTimeMs": 0,
  "durationMs": 1000,
  "tags": [
    "string"
  ],
  "creatorUserId": "{00000000-0000-0000-0000-000000000000}",
  "creationTimeMs": 0,
  "id": "string",
  "share": {
    "expirationTimeMs": 0,
    "password": "string"
  }
}
```

---

### GET `/rest/v4/events/acknowledges/{id}`

**Notification to acknowledge**

Retrieves notification with the given event ID.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Event ID. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Notification to acknowledge
```json
{
  "timestampMs": 0,
  "eventData": {},
  "actionData": {},
  "aggregatedInfo": {
    "total": 0,
    "firstEventsData": [],
    "lastEventsData": []
  },
  "ruleId": "{00000000-0000-0000-0000-000000000000}",
  "flags": "noFlags"
}
```

---

### POST `/rest/v4/events/generic`

**Create generic event**

This method may trigger an event of the "Generic Event" type in the Site from a 3rd party.
Such Event will be handled and logged according to current VMS Rules.
Parameters of the generated Event, such as "source", "caption" and "description", are
intended to be analyzed by these Rules.
<br/> Parameters should be passed as a JSON object in POST message body with content type
"application/json". Example:
<pre><code>
{
    "state": "instant",
    "timestamp": "2024-06-16T16:02:41Z",
    "caption": "CreditCardUsed",
    "deviceIds": [
        "3A4AD4EA-9269-4B1F-A7AA-2CEC537D0248",
        "3A4AD4EA-9269-4B1F-A7AA-2CEC537D0240"
    ]
}
</code></pre>
This example triggers a generic Event informing the Site that a
credit card has been used on June 16, 2024 at 16:03:41 UTC in a POS
terminal being watched by the two specified Devices.

> **Permissions:** Generate events global permission.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "timestamp": "",
  "state": "instant",
  "source": "POS terminal 5",
  "caption": "",
  "description": "",
  "deviceIds": "[]"
}
```

**Responses:**

**default**: 

---

### GET `/rest/v4/events/triggers`

**Software triggers**

Retrieves software triggers available to the given user.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Software triggers
```json
[
  {
    "triggerId": "{00000000-0000-0000-0000-000000000000}",
    "prolonged": false,
    "devices": {
      "ids": [
        "{00000000-0000-0000-0000-000000000000}"
      ],
      "all": false
    },
    "name": "string",
    "icon": "string",
    "schedule": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0
      }
    ]
  }
]
```

---

### POST `/rest/v4/events/triggers`

**Create soft trigger event**

> **Permissions:** Software trigger permission for the given device.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "triggerId": "89abcdef-0123-4567-89ab-cdef01234567",
  "deviceId": "89abcdef-0123-4567-89ab-cdef01234567",
  "state": "started"
}
```

*Required fields: `triggerId`, `deviceId`*

**Responses:**

**default**: 

---

### GET `/rest/v4/events/triggers/{id}`

**Software trigger**

Retrieves software trigger available to the given user.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Trigger ID. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Software trigger
```json
{
  "triggerId": "{00000000-0000-0000-0000-000000000000}",
  "prolonged": false,
  "devices": {
    "ids": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "all": false
  },
  "name": "string",
  "icon": "string",
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ]
}
```

---

### POST `/rest/v4/events/rules`

**Create Rule**

<br/>
An Event Rule can only handle events that are created after the rule itself is created.
For example, if an Generic Event was created and entered the 'started' state before a rule
was created, that later-created rule cannot handle the event when it subsequently moves to
the 'stopped' state.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": ""
}
```

*Required fields: `event`, `action`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": "string"
}
```

---

### GET `/rest/v4/events/rules`

**Get Rules**

Retrieves all Event Rule records stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "event": {
      "attributes": "example string",
      "caption": {
        "checkType": "inList",
        "value": "example string"
      },
      "description": {
        "checkType": "inList",
        "value": "example string"
      },
      "devices": {
        "acceptAll": true,
        "ids": [
          "89abcdef-0123-4567-89ab-cdef01234567"
        ]
      },
      "eventTypeId": {
        "typeId": "nx.lineCrossing"
      },
      "state": "stopped",
      "type": "analytics"
    },
    "action": {
      "devices": {
        "ids": [
          "89abcdef-0123-4567-89ab-cdef01234567"
        ],
        "useSource": true
      },
      "durationS": 10,
      "recordAfterS": 10,
      "recordBeforeS": 10,
      "tags": "example string",
      "type": "bookmark"
    },
    "enabled": false,
    "schedule": [
      {
        "startTime": 0,
        "endTime": 0,
        "dayOfWeek": 0
      }
    ],
    "comment": "string"
  }
]
```

---

### PUT `/rest/v4/events/rules/{id}`

**Replace Rule**

Replaces all fields of the specified Event Record record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Event Rule id. Can be obtained from "id" field via `GET /rest/v4/events/rules`. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": ""
}
```

*Required fields: `event`, `action`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": "string"
}
```

---

### PATCH `/rest/v4/events/rules/{id}`

**Modify Rule**

Modifies certain fields of the specified Event Rule record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Event Rule id. Can be obtained from "id" field via `GET /rest/v4/events/rules`. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": ""
}
```

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": "string"
}
```

---

### GET `/rest/v4/events/rules/{id}`

**Get Rule**

Retrieves the specified Event Rule record stored in the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Event Rule id. Can be obtained from "id" field via `GET /rest/v4/events/rules`. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "event": {
    "attributes": "example string",
    "caption": {
      "checkType": "inList",
      "value": "example string"
    },
    "description": {
      "checkType": "inList",
      "value": "example string"
    },
    "devices": {
      "acceptAll": true,
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ]
    },
    "eventTypeId": {
      "typeId": "nx.lineCrossing"
    },
    "state": "stopped",
    "type": "analytics"
  },
  "action": {
    "devices": {
      "ids": [
        "89abcdef-0123-4567-89ab-cdef01234567"
      ],
      "useSource": true
    },
    "durationS": 10,
    "recordAfterS": 10,
    "recordBeforeS": 10,
    "tags": "example string",
    "type": "bookmark"
  },
  "enabled": false,
  "schedule": [
    {
      "startTime": 0,
      "endTime": 0,
      "dayOfWeek": 0
    }
  ],
  "comment": "string"
}
```

---

### DELETE `/rest/v4/events/rules/{id}`

**Delete Rule**

Deletes the specified Event Rule record from the Site.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Event Rule id. Can be obtained from "id" field via `GET /rest/v4/events/rules`. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/events/rules/*/reset`

**Reset all Event Rules**

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/events/create`

**Create custom event**

<p><b>Proprietary.</b></p><b>ATTENTION:</b> For the debug use only.

> **Permissions:** Generate events global permission.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## LDAP

### POST `/rest/v4/ldap/sync`

**Synchronize LDAP**

Synchronizes LDAP users and groups with the LDAP server.

> **Permissions:** Power User with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "state": "online",
  "isRunning": false,
  "mode": "disabled",
  "message": "string",
  "timeSinceSyncS": 0
}
```

---

### GET `/rest/v4/ldap/sync`

**Get LDAP sync status**

Tells whether the synchronization with the LDAP server is in progress.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "state": "online",
  "isRunning": false,
  "mode": "disabled",
  "message": "string",
  "timeSinceSyncS": 0
}
```

---

### POST `/rest/v4/ldap/authenticate`

**Authenticate LDAP user**

Authenticates a user on the LDAP server. The user fetched is synchronized with the Site
database regardless of the authentication success.

> **Permissions:** Any User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "user": "admin",
  "password": "password123"
}
```

*Required fields: `user`, `password`*

**Responses:**

**default**: User information object
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "admin",
  "email": "string",
  "type": "local",
  "fullName": "string",
  "locale": "en_US",
  "isEnabled": false,
  "isHttpDigestEnabled": false,
  "externalId": {
    "dn": "string",
    "syncId": "string",
    "synced": false
  },
  "parameters": {},
  "groupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "orgGroupIds": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "permissions": "none",
  "temporaryToken": {
    "startS": 1689273703,
    "endS": 1689273704,
    "expiresAfterLoginS": 10000,
    "token": "string"
  },
  "attributes": "readonly",
  "account2faEnabled": false,
  "settings": {
    "eventFilter": "[\"motion\", \"deviceDisconnected\"]",
    "messageFilter": "[\"emailIsEmpty\", \"noLicenses\"]"
  }
}
```

---

### POST `/rest/v4/ldap/test`

**Test LDAP**

Tests the connection with the LDAP server using the settings provided.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "uri": "ldap://organization-server-address.com",
  "adminDn": "cn=admin,dc=la",
  "adminPassword": "password123",
  "loginAttribute": "uid",
  "groupObjectClass": "groupOfNames",
  "memberAttribute": "member",
  "passwordExpirationPeriodMs": 0,
  "searchTimeoutS": 0,
  "responseTimeoutS": 0,
  "searchPageSize": 0,
  "filters": [
    {
      "name": "Users",
      "base": "ou=users,dc=la",
      "filter": ""
    }
  ],
  "continuousSync": "disabled",
  "continuousSyncIntervalS": 0,
  "preferredMasterSyncServer": "{00000000-0000-0000-0000-000000000000}",
  "masterSyncServerCheckIntervalS": 10,
  "isHttpDigestEnabledOnImport": false,
  "startTls": false,
  "ignoreCertificateErrors": false,
  "removeRecords": false,
  "defaultUserLocale": "en_US"
}
```

*Required fields: `uri`, `adminDn`*

**Responses:**

**default**: 

---

### PUT `/rest/v4/ldap/settings`

**Set LDAP settings**

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "uri": "ldap://organization-server-address.com",
  "adminDn": "cn=admin,dc=la",
  "adminPassword": "password123",
  "loginAttribute": "uid",
  "groupObjectClass": "groupOfNames",
  "memberAttribute": "member",
  "passwordExpirationPeriodMs": 0,
  "searchTimeoutS": 0,
  "responseTimeoutS": 0,
  "searchPageSize": 0,
  "filters": [
    {
      "name": "Users",
      "base": "ou=users,dc=la",
      "filter": ""
    }
  ],
  "continuousSync": "disabled",
  "continuousSyncIntervalS": 0,
  "preferredMasterSyncServer": "{00000000-0000-0000-0000-000000000000}",
  "masterSyncServerCheckIntervalS": 10,
  "isHttpDigestEnabledOnImport": false,
  "startTls": false,
  "ignoreCertificateErrors": false,
  "removeRecords": false,
  "defaultUserLocale": "en_US"
}
```

*Required fields: `uri`, `adminDn`*

**Responses:**

**default**: 
```json
{
  "uri": "ldap://organization-server-address.com",
  "adminDn": "cn=admin,dc=la",
  "loginAttribute": "uid",
  "groupObjectClass": "groupOfNames",
  "memberAttribute": "member",
  "passwordExpirationPeriodMs": 0,
  "searchTimeoutS": 0,
  "responseTimeoutS": 0,
  "searchPageSize": 0,
  "filters": [
    {
      "name": "Users",
      "base": "ou=users,dc=la",
      "filter": "string"
    }
  ],
  "continuousSync": "disabled",
  "continuousSyncIntervalS": 0,
  "preferredMasterSyncServer": "{00000000-0000-0000-0000-000000000000}",
  "masterSyncServerCheckIntervalS": 10,
  "isHttpDigestEnabledOnImport": false,
  "startTls": false,
  "ignoreCertificateErrors": false,
  "defaultUserLocale": "en_US"
}
```

---

### PATCH `/rest/v4/ldap/settings`

**Modify LDAP settings**

> **Permissions:** Power User with a fresh session.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "uri": "ldap://organization-server-address.com",
  "adminDn": "cn=admin,dc=la",
  "adminPassword": "password123",
  "loginAttribute": "uid",
  "groupObjectClass": "groupOfNames",
  "memberAttribute": "member",
  "passwordExpirationPeriodMs": 0,
  "searchTimeoutS": 0,
  "responseTimeoutS": 0,
  "searchPageSize": 0,
  "filters": [
    {
      "name": "Users",
      "base": "ou=users,dc=la",
      "filter": ""
    }
  ],
  "continuousSync": "disabled",
  "continuousSyncIntervalS": 0,
  "preferredMasterSyncServer": "{00000000-0000-0000-0000-000000000000}",
  "masterSyncServerCheckIntervalS": 10,
  "isHttpDigestEnabledOnImport": false,
  "startTls": false,
  "ignoreCertificateErrors": false,
  "removeRecords": false,
  "defaultUserLocale": "en_US"
}
```

**Responses:**

**default**: 
```json
{
  "uri": "ldap://organization-server-address.com",
  "adminDn": "cn=admin,dc=la",
  "loginAttribute": "uid",
  "groupObjectClass": "groupOfNames",
  "memberAttribute": "member",
  "passwordExpirationPeriodMs": 0,
  "searchTimeoutS": 0,
  "responseTimeoutS": 0,
  "searchPageSize": 0,
  "filters": [
    {
      "name": "Users",
      "base": "ou=users,dc=la",
      "filter": "string"
    }
  ],
  "continuousSync": "disabled",
  "continuousSyncIntervalS": 0,
  "preferredMasterSyncServer": "{00000000-0000-0000-0000-000000000000}",
  "masterSyncServerCheckIntervalS": 10,
  "isHttpDigestEnabledOnImport": false,
  "startTls": false,
  "ignoreCertificateErrors": false,
  "defaultUserLocale": "en_US"
}
```

---

### GET `/rest/v4/ldap/settings`

**Get LDAP settings**

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "uri": "ldap://organization-server-address.com",
  "adminDn": "cn=admin,dc=la",
  "loginAttribute": "uid",
  "groupObjectClass": "groupOfNames",
  "memberAttribute": "member",
  "passwordExpirationPeriodMs": 0,
  "searchTimeoutS": 0,
  "responseTimeoutS": 0,
  "searchPageSize": 0,
  "filters": [
    {
      "name": "Users",
      "base": "ou=users,dc=la",
      "filter": "string"
    }
  ],
  "continuousSync": "disabled",
  "continuousSyncIntervalS": 0,
  "preferredMasterSyncServer": "{00000000-0000-0000-0000-000000000000}",
  "masterSyncServerCheckIntervalS": 10,
  "isHttpDigestEnabledOnImport": false,
  "startTls": false,
  "ignoreCertificateErrors": false,
  "defaultUserLocale": "en_US"
}
```

---

### DELETE `/rest/v4/ldap/settings`

**Delete LDAP settings**

Deletes LDAP settings and deletes all LDAP users and groups from the VMS Site.

> **Permissions:** Power User with a fresh session.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

## Analytics

### POST `/rest/v4/analytics/integrations/*/requests`

**Create Integration Request**

Creates a new sign up Request from an Integration. Allows an Integration to introduce
itself to the VMS Site. The Request will be offered for an approval by a VMS Administrator.
When approved, the Integration will be able to start working with the VMS Site.

> **Permissions:** Authorization is not required.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "integrationManifest": {
    "id": "",
    "name": "",
    "description": "",
    "version": "",
    "vendor": "",
    "engineSettingsModel": {},
    "isLicenseRequired": false
  },
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "objectActions": [
      {
        "id": "",
        "name": "",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "pinCode": "",
  "isRestOnly": false,
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      ""
    ],
    "supportedObjectTypeIds": [
      ""
    ],
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "",
        "objectTypeId": "",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  }
}
```

*Required fields: `integrationManifest`, `engineManifest`, `pinCode`*

**Responses:**

**default**: Data to be returned after creating an Integration request.
```json
{
  "requestId": "{00000000-0000-0000-0000-000000000000}",
  "username": "string",
  "password": "string"
}
```

---

### GET `/rest/v4/analytics/integrations/*/requests`

**Get Integration Requests**

Retrieves information about all Integration Requests in the Site.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Data to create or update an Integration request in the VMS.
```json
[
  {
    "requestId": "{00000000-0000-0000-0000-000000000000}",
    "integrationManifest": {
      "id": "string",
      "name": "string",
      "description": "string",
      "version": "string",
      "vendor": "string",
      "engineSettingsModel": {},
      "isLicenseRequired": false
    },
    "engineManifest": {
      "capabilities": "noCapabilities",
      "streamTypeFilter": "compressedVideo",
      "preferredStream": "primary",
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "objectActions": [
        {}
      ],
      "deviceAgentSettingsModel": {},
      "typeLibrary": {
        "eventTypes": [],
        "objectTypes": [],
        "groups": [],
        "enumTypes": [],
        "colorTypes": [],
        "extendedObjectTypes": [],
        "extendedEventTypes": [],
        "attributeLists": []
      }
    },
    "pinCode": "string",
    "isRestOnly": false,
    "deviceAgentManifest": {
      "capabilities": "noCapabilities",
      "supportedEventTypeIds": [
        "string"
      ],
      "supportedObjectTypeIds": [
        "string"
      ],
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "supportedTypes": [
        {}
      ],
      "typeLibrary": {
        "eventTypes": [],
        "objectTypes": [],
        "groups": [],
        "enumTypes": [],
        "colorTypes": [],
        "extendedObjectTypes": [],
        "extendedEventTypes": [],
        "attributeLists": []
      }
    },
    "timestampMs": 0,
    "requestAddress": "string",
    "isApproved": false,
    "integrationId": "{00000000-0000-0000-0000-000000000000}",
    "engineId": "{00000000-0000-0000-0000-000000000000}",
    "integrationUserId": "{00000000-0000-0000-0000-000000000000}"
  }
]
```

---

### PATCH `/rest/v4/analytics/integrations/*/requests/{requestId}`

**Modify Integration Request**

Modifes the specified Integration Request.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `requestId` | path | string(uuid) | ✓ | Integration request id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "integrationManifest": {
    "id": "",
    "name": "",
    "description": "",
    "version": "",
    "vendor": "",
    "engineSettingsModel": {},
    "isLicenseRequired": false
  },
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "objectActions": [
      {
        "id": "",
        "name": "",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "pinCode": "",
  "isRestOnly": false,
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      ""
    ],
    "supportedObjectTypeIds": [
      ""
    ],
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "",
        "objectTypeId": "",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  }
}
```

*Required fields: `integrationManifest`, `engineManifest`, `pinCode`*

**Responses:**

**default**: Data to create or update an Integration request in the VMS.
```json
{
  "requestId": "{00000000-0000-0000-0000-000000000000}",
  "integrationManifest": {
    "id": "string",
    "name": "string",
    "description": "string",
    "version": "string",
    "vendor": "string",
    "engineSettingsModel": {},
    "isLicenseRequired": false
  },
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "objectActions": [
      {
        "id": "string",
        "name": "string",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "pinCode": "string",
  "isRestOnly": false,
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      "string"
    ],
    "supportedObjectTypeIds": [
      "string"
    ],
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "string",
        "objectTypeId": "string",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "timestampMs": 0,
  "requestAddress": "string",
  "isApproved": false,
  "integrationId": "{00000000-0000-0000-0000-000000000000}",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "integrationUserId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### PUT `/rest/v4/analytics/integrations/*/requests/{requestId}`

**Replace Integration Request**

Replaces the entire specified Integration Request.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `requestId` | path | string(uuid) | ✓ | Integration request id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "integrationManifest": {
    "id": "",
    "name": "",
    "description": "",
    "version": "",
    "vendor": "",
    "engineSettingsModel": {},
    "isLicenseRequired": false
  },
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "objectActions": [
      {
        "id": "",
        "name": "",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "pinCode": "",
  "isRestOnly": false,
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      ""
    ],
    "supportedObjectTypeIds": [
      ""
    ],
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "",
        "objectTypeId": "",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  }
}
```

*Required fields: `integrationManifest`, `engineManifest`, `pinCode`*

**Responses:**

**default**: Data to create or update an Integration request in the VMS.
```json
{
  "requestId": "{00000000-0000-0000-0000-000000000000}",
  "integrationManifest": {
    "id": "string",
    "name": "string",
    "description": "string",
    "version": "string",
    "vendor": "string",
    "engineSettingsModel": {},
    "isLicenseRequired": false
  },
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "objectActions": [
      {
        "id": "string",
        "name": "string",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "pinCode": "string",
  "isRestOnly": false,
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      "string"
    ],
    "supportedObjectTypeIds": [
      "string"
    ],
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "string",
        "objectTypeId": "string",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "timestampMs": 0,
  "requestAddress": "string",
  "isApproved": false,
  "integrationId": "{00000000-0000-0000-0000-000000000000}",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "integrationUserId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### GET `/rest/v4/analytics/integrations/*/requests/{requestId}`

**Get Integration Request**

Retrieves information about the specific Integration Request.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `requestId` | path | string(uuid) | ✓ | Integration Request id. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Data to create or update an Integration request in the VMS.
```json
{
  "requestId": "{00000000-0000-0000-0000-000000000000}",
  "integrationManifest": {
    "id": "string",
    "name": "string",
    "description": "string",
    "version": "string",
    "vendor": "string",
    "engineSettingsModel": {},
    "isLicenseRequired": false
  },
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "objectActions": [
      {
        "id": "string",
        "name": "string",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "pinCode": "string",
  "isRestOnly": false,
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      "string"
    ],
    "supportedObjectTypeIds": [
      "string"
    ],
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "string",
        "objectTypeId": "string",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  },
  "timestampMs": 0,
  "requestAddress": "string",
  "isApproved": false,
  "integrationId": "{00000000-0000-0000-0000-000000000000}",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "integrationUserId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### DELETE `/rest/v4/analytics/integrations/*/requests/{requestId}`

**Delete Integration Request**

Deletes the specified Integration Request.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `requestId` | path | string(uuid) | ✓ | Integration Request id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/integrations/*/requests/{requestId}/approve`

**Approve Integration Request**

Approves the specified Integration Request. Typically a Client application calls this
function when the VMS Administrator decides to approve the Request. After the Request is
approved, the Integration can learn the ids of its associated Resources using an HTTP API
function `GET rest/v{3-}/users/:integrationRequestId`. See the Analytics API chapter in the
API documentation for more information.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `requestId` | path | string(uuid) | ✓ | Integration Request id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/analytics/engines/*/actions`

**Get Engines' Analytics Actions**

Get Analytics Actions from all or a specified set of Analytics Plugins which are applicable
to the specified metadata Object type.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | query | string(uuid) |  | Server on which the Analytics Actions are applicable to the specified metadata Object type. If not set, non-local engines will be included in the search results. |
| `engineId` | query | array |  | Engine id(s) to get Analytic Actions for. |
| `objectTypeId` | query | string | ✓ | Id of an Object type to which an Action should be applicable. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Map of Available Actions by Engine Id
```json
{}
```

---

### GET `/rest/v4/analytics/engines/{engineId}/actions`

**Get Engine Analytics Actions**

Get Analytics Actions from all or a specified set of Analytics Plugins which are applicable
to the specified metadata Object type.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `serverId` | query | string(uuid) |  | Server on which the Analytics Actions are applicable to the specified metadata Object type. If not set, non-local engines will be included in the search results. |
| `engineId` | path | string | ✓ | Engine id(s) to get Analytic Actions for. |
| `objectTypeId` | query | string | ✓ | Id of an Object type to which an Action should be applicable. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Available Actions
```json
{
  "actionIds": [
    "string"
  ]
}
```

---

### POST `/rest/v4/analytics/engines/{engineId}/actions/{actionId}/execute`

**Execute Analytics Action**

Execute Analytics Action from the particular analytics Plugin on this Server. The Action is
applied to the specified Object Track.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `engineId` | path | string(uuid) | ✓ | Id of an Engine which should handle the Action. |
| `actionId` | path | string | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "objectTrackId": "89abcdef-0123-4567-89ab-cdef01234567",
  "deviceId": "",
  "timestampUs": 0
}
```

*Required fields: `objectTrackId`, `deviceId`, `timestampUs`, `parameters`*

**Responses:**

**default**: 
```json
{
  "actionUrl": "string",
  "messageToUser": "string",
  "useProxy": false,
  "useDeviceCredentials": false
}
```

---

### GET `/rest/v4/analytics/engines/{id}/settings`

**Get Analytics Engine Settings**

Gets settings of an Analytics Engine.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine's id |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "values": {}
}
```

---

### PUT `/rest/v4/analytics/engines/{id}/settings`

**Set Analytics Engine Settings**

Set settings for an Analytics Engine.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Id of an Analytics Engine. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "values": {}
}
```

**Responses:**

**default**: 
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "values": {}
}
```

---

### GET `/rest/v4/analytics/engines/{engineId}/deviceAgents`

**Device Agent current states**

Retrieves the current state of Device Agents.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `engineId` | path | string(uuid) | ✓ |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "id": "string",
    "engineId": "{00000000-0000-0000-0000-000000000000}",
    "isEnabled": false
  }
]
```

---

### GET `/rest/v4/analytics/engines/{engineId}/deviceAgents/{id}`

**Device Agent current state**

Retrieves the current state of the Device Agent identified by the Engine id and Device id.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Flexible id of the Device (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `engineId` | path | string(uuid) | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "id": "string",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "isEnabled": false
}
```

---

### PATCH `/rest/v4/analytics/engines/{engineId}/deviceAgents/{id}`

**Enable/disable Device Agent**

Enables or disables the Device Agent identified by the Engine id and Device id.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | ✓ | Flexible id of the Device (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `engineId` | path | string(uuid) | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "isEnabled": false
}
```

*Required fields: `isEnabled`*

**Responses:**

**default**: 
```json
{
  "id": "string",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "isEnabled": false
}
```

---

### GET `/rest/v4/analytics/engines/{engineId}/deviceAgents/{deviceId}/settings`

**Get Device Agent settings**

Get settings values of the specified DeviceAgent

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ |  |
| `engineId` | path | string(uuid) | ✓ |  |
| `values` | query | string |  | Name-value map with setting values, using JSON types corresponding to each setting type.</br> `object`</br>  |
| `model` | query | string |  | `object`</br>  |
| `_error` | query | string |  | Name-value map with errors that occurred while performing the current settings operation.</br> `string map`</br>  |
| `analyzedStream` | query | `primary` \| `secondary` |  | Index of the stream that should be used for the analytics purposes.  Possible values are: - `"primary"` High-resolution stream. - `"secondary"` Low-resolution stream. |
| `disableStreamSelection` | query | boolean |  | Indicates whether the User is allowed to select which stream (primary or secondary) has to be passed to the Plugin. If true, the analyzed stream is selected according to the Plugin preferences (if any) or defaults to the primary stream. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "deviceId": "string",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "values": {},
  "model": {},
  "analyzedStream": "primary",
  "disableStreamSelection": false
}
```

---

### PUT `/rest/v4/analytics/engines/{engineId}/deviceAgents/{deviceId}/settings`

**Set Device Agent settings**

Set settings values of the specified DeviceAgent

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ |  |
| `engineId` | path | string(uuid) | ✓ |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "values": {},
  "model": {},
  "analyzedStream": "primary",
  "disableStreamSelection": false
}
```

**Responses:**

**default**: 
```json
{
  "deviceId": "string",
  "engineId": "{00000000-0000-0000-0000-000000000000}",
  "values": {},
  "model": {},
  "analyzedStream": "primary",
  "disableStreamSelection": false
}
```

---

### GET `/rest/v4/analytics/engines`

**Get Analytics Engines**

Retrieves all Analytics Engine records stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Analytics Engine records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "name": "string",
    "integrationId": "{00000000-0000-0000-0000-000000000000}"
  }
]
```

---

### GET `/rest/v4/analytics/engines/{id}`

**Get Analytics Engine**

Retrieves the specified Analytics Engine record stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Analytics Engine id. Can be obtained from "id" field via `GET /rest/v4/analytics/engines`. |
| `integrationId` | query | array |  | Integration id. Can be specified to get the Engine id of an Integration. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Analytics Engine record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "name": "string",
  "integrationId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### GET `/rest/v4/analytics/integrations`

**Get Analytics Integrations**

Retrieves all Analytics Integration records stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: List of all Analytics Integration records.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "integrationType": "sdk",
    "sdkIntegrationInfo": {
      "integrationId": "\"my.awesome.integration\"",
      "name": "\"My Awesome Integration\"",
      "description": "\"This Integration does awesome things!\"",
      "version": "\"1.0.1\"",
      "vendor": "\"My Company\"",
      "pluginInfo": {
        "name": "string",
        "description": "string",
        "libName": "string",
        "libraryFilename": "string",
        "homeDir": "string",
        "vendor": "string",
        "version": "string",
        "optionality": "nonOptional",
        "status": "loaded",
        "statusMessage": "string",
        "errorCode": "noError",
        "mainInterface": "undefined",
        "isActive": false,
        "nxSdkVersion": "string",
        "instanceIndex": 0,
        "instanceId": "string"
      }
    },
    "apiIntegrationInfo": {
      "integrationId": "\"my.awesome.integration\"",
      "name": "\"My Awesome Integration\"",
      "description": "\"This Integration does awesome things!\"",
      "version": "\"1.0.1\"",
      "vendor": "\"My Company\"",
      "isOnline": false,
      "integrationUserId": "{00000000-0000-0000-0000-000000000000}"
    }
  }
]
```

---

### GET `/rest/v4/analytics/integrations/{id}`

**Get Analytics Integration**

Retrieves the specified Analytics Integration record stored in the Site.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Analytics Integration id. Can be obtained from "id" field via `GET /rest/v4/analytics/integrations`, |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Analytics Integration record.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "integrationType": "sdk",
  "sdkIntegrationInfo": {
    "integrationId": "\"my.awesome.integration\"",
    "name": "\"My Awesome Integration\"",
    "description": "\"This Integration does awesome things!\"",
    "version": "\"1.0.1\"",
    "vendor": "\"My Company\"",
    "pluginInfo": {
      "name": "string",
      "description": "string",
      "libName": "string",
      "libraryFilename": "string",
      "homeDir": "string",
      "vendor": "string",
      "version": "string",
      "optionality": "nonOptional",
      "status": "loaded",
      "statusMessage": "string",
      "errorCode": "noError",
      "mainInterface": "undefined",
      "isActive": false,
      "nxSdkVersion": "string",
      "instanceIndex": 0,
      "instanceId": "string"
    }
  },
  "apiIntegrationInfo": {
    "integrationId": "\"my.awesome.integration\"",
    "name": "\"My Awesome Integration\"",
    "description": "\"This Integration does awesome things!\"",
    "version": "\"1.0.1\"",
    "vendor": "\"My Company\"",
    "isOnline": false,
    "integrationUserId": "{00000000-0000-0000-0000-000000000000}"
  }
}
```

---

### DELETE `/rest/v4/analytics/integrations/{id}`

**Delete Integration**

Deletes the specified Integration.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Integration id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### GET `/rest/v4/analytics/objectTracks`

**Get Object Tracks**

Searches the Analytics DB for Objects that match the specified filter, and retrieves the
list of the matching Object Tracks.

> **Permissions:** View Archive on specified Device(s).

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `freeText` | query | string |  | Text to match within Object Track Attributes. The text is actually an expression in the special language. Its syntax will likely evolve in the future, and is designed to be close to a "free text" search request in simple cases, so it is described with examples (rather than with a formal definition): <ul> <li>Search for Object Tracks which have an Attribute name or an Attribute value (called here     a string) containing a certain text:     <ul>     <li>`abc`: Match if the word `abc` (case-insensitive) is found at any position in the         string.</li>     <li>`abc def`: Match if both words `abc` and `def` (case-insensitive) are found at any         position in the string, in any order. Any number of words can be specified.</li>     </ul> </li> <li>Search for Object Tracks which have an Attribute with the specified name with a value     containing certain text:     <ul>     <li>`param: expression`: Match if the Attribute with the name `param` is present and its         value matches the expression specified after `:` using the same features as in the         examples above.</li>     <li>`param: "complete"` or `param: $complete^`: Match if the Attribute with the name         `param` is present and its value is exactly `complete` (without any prefix or         suffix).</li>     <li>NOTE: To specify an Attribute name which contains spaces, colons or other special         characters, enquote the Attribute name:         <ul>         <li>`"License Plate": 123`</li>         </ul>     </li>     <li>NOTE: To specify a fragment of an Attribute value which contains quotes, colons,         backslashes or dollar signs, prepend these characters with a backslash:         <ul>         <li>`param: abc\"quoted\"\$\def\\ghi`: Match if the Attribute value contains the             text `abc"quoted"$def\ghi` (case-insensitive) at any position.</li>         </ul>     <li>NOTE: The specified fragment of an Attribute value must contain at least 3         characters.</li>     <li>NOTE: To require that the specified fragment of an Attribute value must start at the          beginning of the value or end at the end of the value, use the symbols `^` or `$`          respectively:          <ul>          <li>`glasses=$red`: Match both `glasses=red` and `glasses=reddish` but not              `glasses=dark-red`.</li>          <li>`glasses=red^`: Match both `glasses=red` and `glasses=dark-red` but not              `glasses=reddish`.</li>          </ul>     </li>     </ul> </li> <li>Search for Object Tracks which have the specified Attribute present, regardless of its     value:     <ul>     <li>`param:` or `$param`: Match if an Attribute with the name `param` is present.</li>     </ul> </li> <li>Search for Object Tracks which have at least one Attribute (i.e. on some particular     video frame in the Object Track) with the specified name with a numeric value that     matches the specified condition:     <ul>     <li>`speed=5`: Match if there is a value equal to 5.</li>     <li>`speed>5`: Match if there is a value greater than 5.</li>     <li>`speed>=5`: Match if there is a value greater than or equal to 5.</li>     <li>`speed<5`: Match if there is a value less than 5.</li>     <li>`speed<=5`: Match if there is a value less than or equal to 5.</li>     <li>`speed=[5...10]` or `speed=5...10`: Match if there is a value in the range from 5 to         10 (inclusive).</li>     <li>`speed=(5...10)`: Match if there is a value which is greater than 5 and less than 10         (i.e. 5 to 10 non-inclusive).</li>     <li>`speed=[-5.4...7.2)`: Match if there is a value which is greater than or equal to         -5.4 and strictly less than 7.2.</li>     </ul> </li> <li>Search for Object Tracks which do not have any Attributes matching the specified     condition:     <ul>     <li>`!wearsGlasses`: Match if the Object Track contains no Attributes with the name         `wearsGlasses`.</li>     </li>`color!=red`: Match if the Object Track does not contain an Attribute with the name         `color` with the value `red`.</li>     </ul> </li> <li>NOTE: If an Object Track contains an Attribute with the name containing a period, e.g.     `glasses.color=red`, the Attribute name specified in the search expression can be a     prefix of this name until the period, e.g. `glasses=red` will match.</li> <li>NOTE: To match any Attribute with the name starting from a certain prefix, append an     asterisk to this prefix: `glas*=red` will match both `glasses.color=red` and     `glassColor=red`.</li> </ul> |
| `deviceId` | query | array |  | If present, only Object Tracks originating from the specified Device(s) will be considered for search. Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `objectTypeId` | query | array |  | If present, only Object Tracks of the specified type(s) will be considered for search. |
| `startTimeMs` | query | string |  | Start of the time period to search within, in milliseconds since epoch (1970-01-01 00:00, UTC). |
| `endTimeMs` | query | string |  | End of the time period to search within, in milliseconds since epoch (1970-01-01 00:00, UTC). |
| `boundingBox` | query | string |  | Coordinates of the picture bounding box to search within; in range [0..1]. The format is `{x},{y},{width}x{height}`. |
| `limit` | query | integer |  | Maximum number of Object Tracks to return. |
| `sortOrder` | query | `asc` \| `desc` |  | Sort order of Object Tracks by a Track start timestamp.  Possible values are: - `"asc"` Ascending order. - `"desc"` Descending order. |
| `analyticsEngineId` | query | string(uuid) |  | If specified, only Object Tracks detected by specified engine will be considered for search. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Object Tracks.
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "objectTypeId": "string",
    "startTimeMs": 0,
    "endTimeMs": 0,
    "objectRegion": {
      "boundingBoxGrid": "string"
    },
    "attributes": [
      {
        "name": "string",
        "value": "string"
      }
    ],
    "bestShot": {
      "timestampMs": 0,
      "boundingBox": "string",
      "streamIndex": "primary"
    },
    "title": {
      "text": "string",
      "imageInfo": {
        "timestampMs": 0,
        "boundingBox": "string",
        "streamIndex": "primary"
      },
      "isImageAvailable": false
    },
    "analyticsEngineId": "{00000000-0000-0000-0000-000000000000}"
  }
]
```

---

### GET `/rest/v4/analytics/objectTracks/{id}`

**Get Object Track**

Retrieves the specified Object Track.

> **Permissions:** View Archive on the Device for the Object Track.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Object Track id |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Object Track.
```json
{
  "id": "{00000000-0000-0000-0000-000000000000}",
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "objectTypeId": "string",
  "startTimeMs": 0,
  "endTimeMs": 0,
  "objectRegion": {
    "boundingBoxGrid": "string"
  },
  "attributes": [
    {
      "name": "string",
      "value": "string"
    }
  ],
  "bestShot": {
    "timestampMs": 0,
    "boundingBox": "string",
    "streamIndex": "primary"
  },
  "title": {
    "text": "string",
    "imageInfo": {
      "timestampMs": 0,
      "boundingBox": "string",
      "streamIndex": "primary"
    },
    "isImageAvailable": false
  },
  "analyticsEngineId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### GET `/rest/v4/analytics/objectTracks/{id}/objectMetadata`

**Get Object Metadata**

Retrieves the Metadata containing rectangles for each frame for an Analytics Object track
from the Archive.

> **Permissions:** View Archive on the Device for the Object Track.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Id of the Analytic Object Track. |
| `deviceId` | query | string | ✓ | Flexible Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Object Metadata.
```json
[
  {
    "deviceId": "{00000000-0000-0000-0000-000000000000}",
    "timestampMs": 0,
    "durationMs": 0,
    "boundingBox": "string",
    "attributes": [
      {
        "name": "string",
        "value": "string"
      }
    ]
  }
]
```

---

### GET `/rest/v4/analytics/objectTracks/{id}/bestShotImage`

**Get Track Best Shot image**

Retrieves the Best Shot image for an Analytics Object Track. The image is returned with its
original MIME type - either one of `image/png`, `image/jpeg`, or `image/tiff`.

> **Permissions:** View Archive on the Device for the Object Track.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Id of the Analytics Object Track. |
| `deviceId` | query | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Best Shot image.

---

### GET `/rest/v4/analytics/objectTracks/{id}/bestShotImage.{format}`

**Get Track Best Shot image, fmt**

Retrieves the Best Shot image for an Analytics Object Track. The image is returned with the
MIME type corresponding to the specified format.

> **Permissions:** View Archive on the Device for the Object Track.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `format` | path | `png` \| `jpg` \| `tif` | ✓ | Defines the MIME type of the image.  Possible values are: - `"png"` `image/png`. - `"jpg"` `image/jpeg`. - `"tif"` `image/tiff`. |
| `id` | path | string(uuid) | ✓ | Id of the Analytics Object Track. |
| `deviceId` | query | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Best Shot image.

---

### GET `/rest/v4/analytics/objectTracks/{id}/titleImage`

**Get Track Title image**

Retrieves the Title image for an Analytics Object Track. The image is returned with its
original MIME type - either one of `image/png`, `image/jpeg`, or `image/tiff`.

> **Permissions:** View Archive on the Device for the Object Track.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Id of the Analytics Object Track. |
| `deviceId` | query | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Title image.

---

### GET `/rest/v4/analytics/objectTracks/{id}/titleImage.{format}`

**Get Track Title image, fmt**

Retrieves the Title image for an Analytics Object Track. The image is returned with the MIME
type corresponding to the specified format.

> **Permissions:** View Archive on the Device for the Object Track.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `format` | path | `png` \| `jpg` \| `tif` | ✓ | Defines the MIME type of the image.  Possible values are: - `"png"` `image/png`. - `"jpg"` `image/jpeg`. - `"tif"` `image/tiff`. |
| `id` | path | string(uuid) | ✓ | Id of the Analytics Object Track. |
| `deviceId` | query | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Title image.

---

### POST `/rest/v4/analytics/engines/{id}/manifest`

**Push Engine manifest**

Equivalent of IEngine::pushManifest().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "engineManifest": {
    "capabilities": "noCapabilities",
    "streamTypeFilter": "compressedVideo",
    "preferredStream": "primary",
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "objectActions": [
      {
        "id": "",
        "name": "",
        "supportedObjectTypeIds": [],
        "parametersModel": {},
        "requirements": {}
      }
    ],
    "deviceAgentSettingsModel": {},
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  }
}
```

*Required fields: `engineManifest`*

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/engines/{engineId}/deviceAgents/{deviceId}/manifest`

**Push Device Agent Manifest**

Equivalent of IDeviceAgent::pushManifest().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `engineId` | path | string(uuid) | ✓ |  |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "deviceAgentManifest": {
    "capabilities": "noCapabilities",
    "supportedEventTypeIds": [
      ""
    ],
    "supportedObjectTypeIds": [
      ""
    ],
    "eventTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "",
        "provider": ""
      }
    ],
    "objectTypes": [
      {
        "id": "",
        "name": "",
        "icon": "",
        "base": "",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "",
        "name": ""
      }
    ],
    "supportedTypes": [
      {
        "eventTypeId": "",
        "objectTypeId": "",
        "attributes": []
      }
    ],
    "typeLibrary": {
      "eventTypes": [
        {}
      ],
      "objectTypes": [
        {}
      ],
      "groups": [
        {}
      ],
      "enumTypes": [
        {}
      ],
      "colorTypes": [
        {}
      ],
      "extendedObjectTypes": [
        {}
      ],
      "extendedEventTypes": [
        {}
      ],
      "attributeLists": [
        {}
      ]
    }
  }
}
```

*Required fields: `deviceAgentManifest`*

**Responses:**

**default**: The data structure that is given by each Analytics Engine's DeviceAgent to the Server after the
DeviceAgent has been created by the Engine.
<br/>
See the description of the fields in `src/nx/sdk/analytics/manifests.md` in the SDK.
```json
{
  "capabilities": "noCapabilities",
  "supportedEventTypeIds": [
    "string"
  ],
  "supportedObjectTypeIds": [
    "string"
  ],
  "eventTypes": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "base": "string",
      "omittedBaseAttributes": [
        "string"
      ],
      "attributes": [
        {}
      ],
      "flags": "noFlags",
      "groupId": "string",
      "provider": "string"
    }
  ],
  "objectTypes": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "base": "string",
      "omittedBaseAttributes": [
        "string"
      ],
      "attributes": [
        {}
      ],
      "provider": "string",
      "flags": "noFlags"
    }
  ],
  "groups": [
    {
      "id": "string",
      "name": "string"
    }
  ],
  "supportedTypes": [
    {
      "eventTypeId": "string",
      "objectTypeId": "string",
      "attributes": [
        "string"
      ]
    }
  ],
  "typeLibrary": {
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "enumTypes": [
      {
        "id": "string",
        "name": "string",
        "base": "string",
        "baseItems": [],
        "items": []
      }
    ],
    "colorTypes": [
      {
        "id": "string",
        "name": "string",
        "base": "string",
        "baseItems": [],
        "items": []
      }
    ],
    "extendedObjectTypes": [
      {
        "id": "string",
        "attributes": []
      }
    ],
    "extendedEventTypes": [
      {
        "id": "string",
        "attributes": []
      }
    ],
    "attributeLists": [
      {
        "id": "string",
        "attributes": []
      }
    ]
  }
}
```

---

### GET `/rest/v4/analytics/engines/{engineId}/deviceAgents/{deviceId}/manifest`

**Get Device Agent Manifest**

> **Permissions:** View Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Flexible Device id. Can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices` or MAC address (not supported for certain cameras). |
| `engineId` | path | array | ✓ |  |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: The data structure that is given by each Analytics Engine's DeviceAgent to the Server after the
DeviceAgent has been created by the Engine.
<br/>
See the description of the fields in `src/nx/sdk/analytics/manifests.md` in the SDK.
```json
{
  "capabilities": "noCapabilities",
  "supportedEventTypeIds": [
    "string"
  ],
  "supportedObjectTypeIds": [
    "string"
  ],
  "eventTypes": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "base": "string",
      "omittedBaseAttributes": [
        "string"
      ],
      "attributes": [
        {}
      ],
      "flags": "noFlags",
      "groupId": "string",
      "provider": "string"
    }
  ],
  "objectTypes": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "base": "string",
      "omittedBaseAttributes": [
        "string"
      ],
      "attributes": [
        {}
      ],
      "provider": "string",
      "flags": "noFlags"
    }
  ],
  "groups": [
    {
      "id": "string",
      "name": "string"
    }
  ],
  "supportedTypes": [
    {
      "eventTypeId": "string",
      "objectTypeId": "string",
      "attributes": [
        "string"
      ]
    }
  ],
  "typeLibrary": {
    "eventTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "flags": "noFlags",
        "groupId": "string",
        "provider": "string"
      }
    ],
    "objectTypes": [
      {
        "id": "string",
        "name": "string",
        "icon": "string",
        "base": "string",
        "omittedBaseAttributes": [],
        "attributes": [],
        "provider": "string",
        "flags": "noFlags"
      }
    ],
    "groups": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "enumTypes": [
      {
        "id": "string",
        "name": "string",
        "base": "string",
        "baseItems": [],
        "items": []
      }
    ],
    "colorTypes": [
      {
        "id": "string",
        "name": "string",
        "base": "string",
        "baseItems": [],
        "items": []
      }
    ],
    "extendedObjectTypes": [
      {
        "id": "string",
        "attributes": []
      }
    ],
    "extendedEventTypes": [
      {
        "id": "string",
        "attributes": []
      }
    ],
    "attributeLists": [
      {
        "id": "string",
        "attributes": []
      }
    ]
  }
}
```

---

### GET `/rest/v4/analytics/engines/*/deviceAgents/{deviceId}/manifest`

**Get Device Agent Manifests**

> **Permissions:** View Archive on selected Device.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string | ✓ | Flexible Device id. Can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices` or MAC address (not supported for certain cameras). |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Manifests by Engine Id
```json
{}
```

---

### POST `/rest/v4/analytics/engines/{id}/integrationDiagnosticEvent`

**Push Engine Diagnostic Event**

Equivalent of IEngine::pushIntegrationDiagnosticEvent().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "level": "info",
  "caption": "",
  "description": ""
}
```

*Required fields: `level`, `caption`, `description`*

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/engines/{id}/deviceAgents/{deviceId}/integrationDiagnosticEvent`

**Push Agent Diagnostic Event**

Equivalent of IDeviceAgent::pushIntegrationDiagnosticEvent().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "level": "info",
  "caption": "",
  "description": ""
}
```

*Required fields: `level`, `caption`, `description`*

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/engines/{id}/deviceAgents/{deviceId}/metadata/object`

**Push Object metadata**

Equivalent of IDeviceAgent::IHandler::handleMetadata().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "flags": "none",
  "timestampMs": 0,
  "durationMs": 0,
  "objects": [
    {
      "trackId": "{00000000-0000-0000-0000-000000000000}",
      "subtype": "",
      "boundingBox": "",
      "typeId": "",
      "confidence": 0,
      "attributes": [
        {}
      ]
    }
  ]
}
```

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/engines/{id}/deviceAgents/{deviceId}/metadata/event`

**Push Event metadata**

Equivalent of IDeviceAgent::IHandler::handleMetadata().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "flags": "none",
  "timestampMs": 0,
  "durationMs": 0,
  "events": [
    {
      "typeId": "",
      "caption": "",
      "description": "",
      "isActive": false,
      "trackId": "{00000000-0000-0000-0000-000000000000}",
      "key": ""
    }
  ]
}
```

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/engines/{id}/deviceAgents/{deviceId}/metadata/bestShot`

**Push Best Shot metadata**

Equivalent of IDeviceAgent::IHandler::handleMetadata().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "trackId": "{00000000-0000-0000-0000-000000000000}",
  "flags": "none",
  "timestampMs": 0,
  "boundingBox": "",
  "imageUrl": "",
  "imageData": [],
  "imageDataFormat": "",
  "attributes": [
    {
      "type": "Number",
      "name": "",
      "value": "",
      "confidence": 0
    }
  ]
}
```

**Responses:**

**default**: 

---

### POST `/rest/v4/analytics/engines/{id}/deviceAgents/{deviceId}/metadata/title`

**Push Title metadata**

Equivalent of IDeviceAgent::IHandler::handleMetadata().

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string(uuid) | ✓ | Engine id |
| `deviceId` | path | string | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain cameras). |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "trackId": "{00000000-0000-0000-0000-000000000000}",
  "flags": "none",
  "timestampMs": 0,
  "boundingBox": "",
  "text": "",
  "imageUrl": "",
  "imageData": [],
  "imageDataFormat": ""
}
```

**Responses:**

**default**: 

---

## Metrics

### GET `/rest/v4/metrics/manifest`

**Get Metrics manifest**

Retrieves the manifest for `GET /rest/v4/metrics/alarms` and
`GET /rest/v4/metrics/values` visualization.

> **Permissions:** Metrics' Viewer.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
[
  {
    "id": "string",
    "name": "string",
    "resource": "string",
    "values": [
      {
        "id": "string",
        "name": "string",
        "values": []
      }
    ]
  }
]
```

---

### GET `/rest/v4/metrics/rules`

**Get Metrics rules**

Retrieves the rules to calculate the final manifest and raise alarms. See metrics.md for
details.

> **Permissions:** Metrics' Viewer.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Structure of rules.
```json
{}
```

---

### GET `/rest/v4/metrics/values`

**Get Metrics values**

Retrieves the current state of the Metrics values.

> **Permissions:** Metrics' Viewer.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_formatted` | query | boolean |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Site Metrics values structured as per the manifest.

---

### GET `/rest/v4/metrics/alarms`

**Get Metrics alarms**

Retrieves the currently active Metrics alarms.

> **Permissions:** Metrics' Viewer.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Active alarms structured as per the manifest.

---

## Update

### POST `/rest/v4/update/start`

**Start Update**

Starts an update process. Input to this can be requested from /rest/v4/update/info

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "version": "",
  "cloudHost": "",
  "eulaLink": "",
  "eulaVersion": 50100,
  "releaseNotesUrl": "",
  "releaseDateMs": 86400000,
  "releaseDeliveryDays": 90,
  "description": "",
  "eula": "",
  "packages": {
    "client": [
      {
        "platform": "",
        "customClientVariant": "",
        "platformVariants": {},
        "file": "",
        "md5": "",
        "sizeB": 1073741824,
        "signature": "",
        "url": ""
      }
    ],
    "customClient": [
      {
        "platform": "",
        "customClientVariant": "",
        "platformVariants": {},
        "file": "",
        "md5": "",
        "sizeB": 1073741824,
        "signature": "",
        "url": ""
      }
    ],
    "server": [
      {
        "platform": "",
        "customClientVariant": "",
        "platformVariants": {},
        "file": "",
        "md5": "",
        "sizeB": 1073741824,
        "signature": "",
        "url": ""
      }
    ]
  },
  "url": "",
  "freeSpaceB": 1073741824,
  "participants": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "lastInstallationRequestTimeMs": 86400000
}
```

*Required fields: `version`, `cloudHost`, `eulaLink`, `eulaVersion`, `releaseNotesUrl`, `releaseDateMs`, `releaseDeliveryDays`, `description`, `eula`, `packages`, `url`, `freeSpaceB`, `participants`, `lastInstallationRequestTimeMs`*

**Responses:**

**default**: 
```json
{
  "updateInformation": {
    "version": "string",
    "cloudHost": "string",
    "eulaLink": "string",
    "eulaVersion": 50100,
    "releaseNotesUrl": "string",
    "releaseDateMs": 86400000,
    "releaseDeliveryDays": 90,
    "description": "string",
    "eula": "string",
    "packages": {
      "client": [
        {}
      ],
      "customClient": [
        {}
      ],
      "server": [
        {}
      ]
    },
    "url": "string",
    "freeSpaceB": 1073741824,
    "participants": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "lastInstallationRequestTimeMs": 86400000
  },
  "persistentStorageServers": [
    "{00000000-0000-0000-0000-000000000000}"
  ]
}
```

---

### POST `/rest/v4/update/install`

**Install Update**

Initiates update package installation.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "peers": [
    "{00000000-0000-0000-0000-000000000000}"
  ]
}
```

*Required fields: `peers`*

**Responses:**

**default**: 

---

### POST `/rest/v4/update/finish`

**Finish Update**

Puts a Site in the 'Update Finished' state.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "ignorePendingPeers": false
}
```

**Responses:**

**default**: 

---

### POST `/rest/v4/update/retry`

**Retry Update**

Retries the latest failed update action. E.g. if one of servers has failed update because
there was not enough free space, it will retry to reserve space and start downloading.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Update status information per Server.
```json
{}
```

---

### GET `/rest/v4/update/info`

**Update Information**

Retrieves a currently present or specified via a parameter update information manifest.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `updateComponent` | query | `client` \| `customClient` \| `server` |  | Possible values are: - `"client"` Desktop Client. - `"customClient"` Desktop Client with custom branding. - `"server"` VMS Server. |
| `publicationType` | query | `local` \| `private_build` \| `private_patch` \| `patch` \| `beta` \| `rc` \| `release` |  | Possible values are: - `"local"` Local developer build. - `"private_build"` Private build for QA team. - `"private_patch"` Private patch for a single setup. - `"patch"` Regular monthly patch. - `"beta"` Public beta version. - `"rc"` Public release candidate. - `"release"` Public release. |
| `version` | query | string |  | If present, the Server makes an attempt to retrieve an update manifest for the specified version id from the dedicated updates server and return it as a result. |
| `protocolVersion` | query | integer |  | Integer version of the release |
| `infoCategory` | query | `target` \| `installed` \| `latest` \| `specific` |  | Information Category to request.  Possible values are: - `"target"` The version to be installed. - `"installed"` The currently installed version. - `"latest"` The latest available version. - `"specific"` The explicitly specified version. |
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Update Information.
```json
{
  "version": "string",
  "cloudHost": "string",
  "eulaLink": "string",
  "eulaVersion": 50100,
  "releaseNotesUrl": "string",
  "releaseDateMs": 86400000,
  "releaseDeliveryDays": 90,
  "description": "string",
  "eula": "string",
  "packages": {
    "client": [
      {
        "platform": "string",
        "customClientVariant": "string",
        "platformVariants": {},
        "file": "string",
        "md5": "string",
        "sizeB": 1073741824,
        "signature": "string",
        "url": "string"
      }
    ],
    "customClient": [
      {
        "platform": "string",
        "customClientVariant": "string",
        "platformVariants": {},
        "file": "string",
        "md5": "string",
        "sizeB": 1073741824,
        "signature": "string",
        "url": "string"
      }
    ],
    "server": [
      {
        "platform": "string",
        "customClientVariant": "string",
        "platformVariants": {},
        "file": "string",
        "md5": "string",
        "sizeB": 1073741824,
        "signature": "string",
        "url": "string"
      }
    ]
  },
  "url": "string",
  "freeSpaceB": 1073741824,
  "participants": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "lastInstallationRequestTimeMs": 86400000
}
```

---

### GET `/rest/v4/update`

**Get Update Status**

Retrieves the current update processing Site-wide state.

> **Permissions:** Any User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Update status information per Server.
```json
{}
```

---

### DELETE `/rest/v4/update`

**Cancel Update**

Puts a Site in the 'Idle' update state. The current update manifest will be cleared and all
downloads will be cancelled.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 

---

### POST `/rest/v4/update/storage`

**Set Server Persistent Storage**

Set a list of Server ids used for persistent update file storage.

> **Permissions:** Power User.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "servers": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "autoSelection": false,
  "infoCategory": "target"
}
```

*Required fields: `servers`, `autoSelection`, `infoCategory`*

**Responses:**

**default**: 
```json
{
  "servers": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "autoSelection": false,
  "infoCategory": "target"
}
```

---

### GET `/rest/v4/update/storage/{infoCategory}`

**Get Persistent Storage Servers**

Retrieves a currently present list of Server ids used for update file storage.

> **Permissions:** Power User.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `infoCategory` | path | `target` \| `installed` \| `latest` \| `specific` | ✓ | Possible values are: - `"target"` The version to be installed. - `"installed"` The currently installed version. - `"latest"` The latest available version. - `"specific"` The explicitly specified version. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: 
```json
{
  "servers": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "autoSelection": false,
  "infoCategory": "target"
}
```

---

## Utilities

### POST `/jsonrpc`

**JSON-RPC (HTTP)**

Allows executing API requests in the JSON RPC format over HTTP. For more information see the
JSON-RPC section in the API Information page.

> **Permissions:** Depends on Resource access rights.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `_orderBy` | query | array |  |  |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
[
  {
    "jsonrpc": "2.0",
    "id": "",
    "method": "rest.v{1-}.servers.info.all",
    "extensions": {},
    "params": {}
  }
]
```

**Responses:**

**default**: 
```json
[
  {
    "jsonrpc": "2.0",
    "id": "string",
    "error": {
      "code": 0,
      "message": "string"
    },
    "extensions": {}
  }
]
```

---

### GET `/jsonrpc`

**JSON-RPC (WebSocket)**

<p>
Allows executing API requests in the JSON-RPC format over a WebSocket. For more information
see the JSON-RPC section in the API Information page.
</p>
<p>
Initial authorization is not required or must be a Session authorization. Later,
authorization can be (re)applied using one of `rest.v{1-}.login.sessions.*` method request
with `setSession=true`.
</p>
<p>
JSON-RPC WebSocket Example can be found here [/ui/jsonrpc.html](/ui/jsonrpc.html).
</p>

> **Permissions:** Depends on Resource access rights.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Response with "switching protocols" HTTP status code.

---

### OPTIONS `/jsonrpc`

**JSON-RPC (WebSocket options)**

<p>
Allows executing API requests in the JSON-RPC format over a WebSocket. For more information
see the JSON-RPC section in the API Information page.
</p>
<p>
Initial authorization is not required or must be a Session authorization. Later,
authorization can be (re)applied using one of `rest.v{1-}.login.sessions.*` method request
with `setSession=true`.
</p>
<p>
JSON-RPC WebSocket Example can be found here [/ui/jsonrpc.html](/ui/jsonrpc.html).
</p>

> **Permissions:** Depends on Resource access rights.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Response with the "switching protocols" HTTP status code.

---

### GET `/rest/v4/secureCookieStorage`

**Decode all secure cookies**

> **Permissions:** Authorization is not required.

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Map of decoded secure cookie values.
```json
{}
```

---

### GET `/rest/v4/secureCookieStorage/{name}`

**Decode a secure cookie**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | ✓ | Name of the secure cookie to decode. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Responses:**

**default**: Decoded secure cookie value.
```json
{
  "value": "string"
}
```

---

### PUT `/rest/v4/secureCookieStorage/{name}`

**Encode value**

> **Permissions:** Authorization is not required.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | ✓ | Name of the secure cookie to decode. |

*Also supports common query params: `_format`, `_stripDefault`, `_keepDefault`, `_language`, `_pretty`, `_strict`, `_with`, `_local`, `_filter`, `_ticket`*

**Request Body:**

Content-Type: `application/json`

```json
{
  "value": "value_to_encode",
  "expiresS": 0
}
```

*Required fields: `value`*

**Responses:**

**default**: 
```json
{
  "value": "value_to_encode",
  "expiresS": 0
}
```

---

### GET `/ec2/transactionBus/websocket`

**Transaction Bus (WebSocket)**

<p><b>Use <b>GET /jsonrpc</b> subscriptions for REST endpoints instead.
<p>
<b>ATTENTION:</b> The output data structure depends on the proprietary database structure
which may change in any VMS Server version without further notice. Use at your own risk.
</p>
Allows third-party systems to get access to the Server Transaction Bus. A third-party
peer should undergo the usual (the same as when accessing Server API or Site API)
authentication process before using a WebSocket connection. Transactions are transferred
in the JSON format by default. Example: ws://10.0.2.1/ec2/transactionBus/websocket
<br/>
Refer to the "Transaction Bus" section in the API function tree for the documentation.</b></p>

> ⚠️ **DEPRECATED**

**Responses:**

**default**: A ready-to-use WebSocket connection, read-only as of now.

---

### GET `/ec2/transactionBus/http`

**Transaction Bus (HTTP)**

<p><b>Use <b>GET /jsonrpc</b> subscriptions for REST endpoints instead.
<p>
<b>ATTENTION:</b> The output data structure depends on the proprietary database structure
which may change in any VMS Server version without further notice. Use at your own risk.
</p>
Allows third-party systems to get access to the Server Transaction Bus.
Transactions are transferred in the JSON format by default.
Example: http://10.0.2.1/ec2/transactionBus/http
<br/>
Refer to the "Transaction Bus" section in the API function tree for the documentation.</b></p>

> ⚠️ **DEPRECATED**

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `noInitialData` | query | `true` |  | If specified, then the initial database is not sent to a Client on the connection start. |
| `filter` | query | string |  | Filter transactions by their types. It is possible to specify several types via `\|` delimiter. |

**Responses:**

**default**: A ready-to-use HTTP connection, read-only as of now.

---

### GET `/{deviceId}`

**RTSP streaming**

Opens RTSP video stream from Device. It is not exactly an API function but rather a URL
format. Example:
<code>rtsp://&lt;server_ip&gt;:&lt;port&gt;/12AB42FD5912?pos=1235631&amp;resolution=240p</code>
<br/>
ATTENTION: By default all Users are created with disabled Basic/Digest authentication, so
only session-based authentication which requires SSL/TLS connections to be used (see
General information about VMS Server API for details). Most of the 3rd party players and
libraries (vlc, ffmpeg, live555, etc.) support only standard RTSP, which can be used only
for the Users with enabled Basic/Digest authentication.
ATTENTION: VMS stores the digest in lowercase, so third-party software must pass the login
in lower case.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deviceId` | path | string(uuid) | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain Devices). |
| `pos` | query | string |  | By default, Server opens Device at the live position. This parameter defines position in an archive (as a string containing time in milliseconds since epoch, or a local time formatted like <code>"<i>YYYY</i>-<i>MM</i>-<i>DD</i>T<i>HH</i>:<i>mm</i>:<i>ss</i>.<i>zzz</i>"</code> - the format is auto-detected). Position can be passed via standard RTSP attribute as well. |
| `resolution` | query | string |  | Turn on video transcoding to the specified resolution. Resolution string either may contain width and height (for instance 320x240) or height only (for instance 240p). |
| `rotation` | query | `0` \| `90` \| `180` \| `270` |  | Rotate item, in degrees. If the parameter is absent, video will be rotated to the default value defined in Device settings dialog. Parameter take place if video transcoding is activated (parameter `codec` and/or parameter `resolution` are presented). |
| `codec` | query | `H263p` \| `H264` \| `mpeg2video` \| `mjpeg` \| `mpeg4` \| `libvpx` |  | Defines video codec used for transcoding. Default value is H263p.  Possible values are: - `"H263p"` H263 plus format - `"H264"` H264 format - `"mpeg2video"` - `"mjpeg"` Motion JPEG - `"mpeg4"` MPEG-4 part 2 - `"libvpx"` VP8 video codec |
| `acodec` | query | `aac` \| `mp2` |  | Defines audio codec used for transcoding.  Possible values are: - `"aac"` AAC format - `"mp2"` Mpeg Layer 2 format |
| `stream` | query | integer |  | Open high quality stream if parameter is 0 or low quality stream if parameter is 1. By default Server auto-detects preferred stream index based on destination resolution. |
| `speed` | query | string |  | Playback speed. Only values in range [1..32] are supported. Default value is 1. The special value `max` means streaming without delay. |
| `multiple_payload_types` | query | string |  | Generate SDP with two payload types (high and low qualities). Payload type of RTP packets will be changed in according to transmitted stream. |
| `onvif_replay` | query | `true` |  | Insert ONVIF header extension that contains absolute timestamp (See: ONVIF Streaming Specification Ver. 17.06, 6.3 RTP header extension). |
| `disable_fast_channel_zapping` | query | `true` |  | Disable fast channel zapping, the stream will wait before starting, until the next key frame from Device is received. |
| `enable_analytics_objects` | query | `true` |  | Add an RTSP channel that contains Analytics Objects data in the JSON format. |
| `enable_start_time_header` | query | `true` |  | Add `x-start-time` header when responding to PLAY request, only relevant if disable_fast_channel_zapping is absent (or false). |
| `_orderBy` | query | array |  |  |

**Responses:**

**default**: RTSP video/audio/metadata streams.
NOTE for analytics streaming: if Device has analytics plugin then RTSP server creates
addition track with type 'text'. This track contains analytics objects in the JSON format described below.
RTP packet has 'marker' bit in case of it includes the end of a Json object.
```json
{
  "deviceId": "{00000000-0000-0000-0000-000000000000}",
  "timestampUs": "string",
  "durationUs": "string",
  "objectMetadataList": [
    {
      "trackId": "{00000000-0000-0000-0000-000000000000}",
      "boundingBox": {},
      "typeId": "car",
      "attributes": [
        {}
      ]
    }
  ],
  "bestShot": {
    "trackId": "{00000000-0000-0000-0000-000000000000}",
    "boundingBox": {},
    "location": "undefined",
    "attributes": [
      {
        "name": "string",
        "value": "string"
      }
    ]
  },
  "title": {
    "trackId": "{00000000-0000-0000-0000-000000000000}",
    "boundingBox": {},
    "location": "undefined",
    "text": "string"
  },
  "streamIndex": "primary",
  "analyticsEngineId": "{00000000-0000-0000-0000-000000000000}"
}
```

---

### GET `/api/http_audio`

**Audio backchannel streaming**

Open websocket audio stream to Device. Example:
<code>
wss://&lt;server_ip&gt;:&lt;port&gt;/api/http_audio?camera_id=2a4717bb-1d3e-4878-a28b-af4eaedbfb89&format=f32le&sample_rate=44100&channels=1
</code>

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `format` | query | `u8` \| `s16be` \| `s16le` \| `s32be` \| `s32le` \| `f32be` \| `f32le` \| `f64be` \| `f64le` |  | Audio sample format. |
| `camera_id` | query | string(uuid) | ✓ | Device id (can be obtained from "id", "physicalId" or "logicalId" field via `GET /rest/v4/devices`) or MAC address (not supported for certain Devices). |
| `live` | query | `true` |  | Is live stream or not, if not present (or false), then Server will try to read all data and then start to parse audio data. |
| `sample_rate` | query | integer |  | Audio sample rate. |
| `channels` | query | `1` \| `2` |  | Audio channel count. 1 for mono, 2 for stereo. |

**Responses:**

**default**: Audio stream in the requested format.

---

### GET `/proxy/{protocol}/{serverId}/{apiRequest}`

**Proxying**

<p>
Proxy methods allow to send any request to any Server using the existing public connection.
It is useful to login on a Server that is hidden from the requestor via executing
`POST /proxy/https-insecure/{hiddenServerEndpoint}/rest/v4/login/sessions` to the proxy
Server that has access to the hidden Server, this request requires Administrator permission
on the proxy Server.
</p>
<p>
Can also be used to get video streams. Example:
<code>
rtsp://&lt;server_ip&gt;:&lt;port&gt;/proxy/rtsp/{72934575-ceb7-54bb-23a0-84b81cf1d3f1}/12AB42FD5912?pos=1235631&resolution=240p
</code>
Example:
<code>
https://&lt;server_ip&gt;:&lt;port&gt;/proxy/https/{72934575-ceb7-54bb-23a0-84b81cf1d3f1}/showLog
</code>
</p>

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `protocol` | path | string | ✓ |  |
| `serverId` | path | string(uuid) | ✓ |  |
| `apiRequest` | path | string | ✓ |  |

**Responses:**

**default**: Result of the target API request.

---

# Legacy/Beta API

## Proprietary System API (Legacy/Beta)

This group contains proprietary functions related to the whole VMS Site (all Servers). For these functions no backward compatibility is guaranteed, and their use by third party integrations is discouraged.

### POST `/ec2/addCameraHistoryItem`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "serverGuid": "89abcdef-0123-4567-89ab-cdef01234567",
  "archivedCameras": [
    "{00000000-0000-0000-0000-000000000000}"
  ]
}
```

*Required fields: `serverGuid`, `archivedCameras`*

**Responses:**

**default**: 

---

### POST `/ec2/addDiscoveryInformation`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "id": "89abcdef-0123-4567-89ab-cdef01234567",
  "url": "",
  "ignore": false
}
```

*Required fields: `id`, `url`, `ignore`*

**Responses:**

**default**: 

---

### POST `/ec2/changeSystemId`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "systemId": "89abcdef-0123-4567-89ab-cdef01234567",
  "sysIdTime": "",
  "tranLogTime": {
    "sequence": "",
    "ticks": ""
  }
}
```

*Required fields: `systemId`, `sysIdTime`, `tranLogTime`*

**Responses:**

**default**: 

---

### POST `/ec2/discoverPeer`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "url": "",
  "id": "89abcdef-0123-4567-89ab-cdef01234567"
}
```

*Required fields: `url`, `id`*

**Responses:**

**default**: 

---

### POST `/ec2/discoveredServerChanged`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "port": 0,
  "id": "89abcdef-0123-4567-89ab-cdef01234567",
  "type": "",
  "customization": "",
  "brand": "",
  "version": "",
  "name": "",
  "sslAllowed": false,
  "protoVersion": 0,
  "runtimeId": "89abcdef-0123-4567-89ab-cdef01234567",
  "realm": "",
  "cloudPortalUrl": "",
  "cloudHost": "",
  "hwPlatform": "unknown",
  "synchronizedTimeMs": 0,
  "cloudOwnerId": "{00000000-0000-0000-0000-000000000000}",
  "organizationId": "{00000000-0000-0000-0000-000000000000}",
  "saasState": "uninitialized",
  "serverFlags": "SF_None",
  "systemName": "",
  "cloudSystemId": "",
  "localSystemId": "89abcdef-0123-4567-89ab-cdef01234567",
  "ecDbReadOnly": false,
  "remoteAddresses": [
    ""
  ],
  "status": "Offline"
}
```

*Required fields: `port`, `id`, `type`, `customization`, `brand`, `version`, `name`, `sslAllowed`, `protoVersion`, `runtimeId`, `realm`, `cloudPortalUrl`, `cloudHost`, `hwPlatform`, `synchronizedTimeMs`, `saasState`, `serverFlags`, `systemName`, `cloudSystemId`, `localSystemId`, `ecDbReadOnly`, `remoteAddresses`, `status`*

**Responses:**

**default**: 

---

### POST `/ec2/discoveredServersList`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
[
  {
    "port": 0,
    "id": "89abcdef-0123-4567-89ab-cdef01234567",
    "type": "",
    "customization": "",
    "brand": "",
    "version": "",
    "name": "",
    "sslAllowed": false,
    "protoVersion": 0,
    "runtimeId": "89abcdef-0123-4567-89ab-cdef01234567",
    "realm": "",
    "cloudPortalUrl": "",
    "cloudHost": "",
    "hwPlatform": "unknown",
    "synchronizedTimeMs": 0,
    "cloudOwnerId": "{00000000-0000-0000-0000-000000000000}",
    "organizationId": "{00000000-0000-0000-0000-000000000000}",
    "saasState": "uninitialized",
    "serverFlags": "SF_None",
    "systemName": "",
    "cloudSystemId": "",
    "localSystemId": "89abcdef-0123-4567-89ab-cdef01234567",
    "ecDbReadOnly": false,
    "remoteAddresses": [
      ""
    ],
    "status": "Offline"
  }
]
```

**Responses:**

**default**: 

---

### GET `/ec2/dumpDatabaseToFile`

<p><b>Proprietary.</b></p>Back up the Site database (shared among all Servers) to the specified file.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `format` | query | `ubjson` \| `json` \| `xml` \| `csv` |  | Data format. Default value is "json".  Possible values are: - `"ubjson"` Universal Binary JSON data format. - `"json"` JSON data format. - `"xml"` XML data format. - `"csv"` CSV data format. In case of a hierarchical structure, only the top level data is provided. |
| `path` | query | string | ✓ | Path to a file to be created on the current Server's filesystem. |

**Responses:**

**default**: Object in the requested format, describing the created file.
```json
{
  "size": "string"
}
```

---

### GET `/ec2/getDiscoveryData`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 
```json
[
  {
    "id": "{00000000-0000-0000-0000-000000000000}",
    "url": "string",
    "ignore": false
  }
]
```

---

### GET `/ec2/getStatisticsReport`

<p><b>Proprietary.</b></p>Get anonymous statistic about the Site.

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string",
  "reply": {
    "systemId": "{00000000-0000-0000-0000-000000000000}",
    "reportInfo": {
      "id": "{00000000-0000-0000-0000-000000000000}",
      "number": "string"
    },
    "vmsRules": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "eventList": [],
        "actionList": [],
        "enabled": false,
        "schedule": [],
        "comment": "string"
      }
    ],
    "cameras": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "parentId": "{00000000-0000-0000-0000-000000000000}",
        "name": "string",
        "url": "string",
        "typeId": "{00000000-0000-0000-0000-000000000000}",
        "mac": "string",
        "physicalId": "string",
        "manuallyAdded": false,
        "model": "string",
        "groupId": "string",
        "groupName": "string",
        "statusFlags": "CSF_NoFlags",
        "vendor": "string",
        "cameraId": "{00000000-0000-0000-0000-000000000000}",
        "cameraName": "string",
        "userDefinedGroupName": "string",
        "scheduleEnabled": false,
        "motionType": "default",
        "motionMask": "string",
        "scheduleTasks": [],
        "audioEnabled": false,
        "disableDualStreaming": false,
        "controlEnabled": false,
        "dewarpingParams": "string",
        "minArchivePeriodS": "string",
        "maxArchivePeriodS": "string",
        "preferredServerId": "{00000000-0000-0000-0000-000000000000}",
        "failoverPriority": "Never",
        "backupQuality": "CameraBackupBoth",
        "logicalId": "string",
        "recordBeforeMotionSec": 0,
        "recordAfterMotionSec": 0,
        "backupContentType": "archive",
        "backupPolicy": "byDefault",
        "status": "Offline",
        "addParams": [],
        "analyticsInfo": {},
        "customAnalyticsInfo": {}
      }
    ],
    "licenses": [
      {
        "name": "string",
        "key": "string",
        "licenseType": "string",
        "version": "string",
        "brand": "string",
        "expiration": "string",
        "validation": "string",
        "cameraCount": "string"
      }
    ],
    "mediaservers": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "parentId": "{00000000-0000-0000-0000-000000000000}",
        "name": "string",
        "url": "string",
        "typeId": "{00000000-0000-0000-0000-000000000000}",
        "networkAddresses": "string",
        "flags": "SF_None",
        "version": "string",
        "systemInfo": "string",
        "authKey": "string",
        "osInfo": "string",
        "serverId": "{00000000-0000-0000-0000-000000000000}",
        "serverName": "string",
        "maxCameras": 0,
        "allowAutoRedundancy": false,
        "backupBitrateBytesPerSecond": [],
        "locationId": 0,
        "status": "Offline",
        "addParams": [],
        "storages": [],
        "pluginInfo": []
      }
    ],
    "layouts": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "parentId": "{00000000-0000-0000-0000-000000000000}",
        "name": "Layout",
        "cellAspectRatio": 0,
        "cellSpacing": 0,
        "items": [],
        "locked": false,
        "fixedWidth": 1,
        "fixedHeight": 1,
        "logicalId": 0,
        "backgroundImageFilename": "string",
        "backgroundWidth": 0,
        "backgroundHeight": 0,
        "backgroundOpacity": 0
      }
    ],
    "users": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "parentId": "{00000000-0000-0000-0000-000000000000}",
        "name": "string",
        "url": "string",
        "typeId": "{00000000-0000-0000-0000-000000000000}",
        "type": "local",
        "isEnabled": false,
        "fullName": "string",
        "email": "string",
        "permissions": "none",
        "groupIds": [],
        "externalId": {},
        "attributes": "readonly",
        "digest": "string",
        "hash": "string",
        "cryptSha512Hash": "string",
        "locale": "en_US",
        "orgGroupIds": []
      }
    ],
    "videowalls": [
      {
        "id": "{00000000-0000-0000-0000-000000000000}",
        "parentId": "{00000000-0000-0000-0000-000000000000}",
        "name": "Video wall",
        "typeId": "{00000000-0000-0000-0000-000000000000}",
        "autorun": false,
        "timeline": false,
        "items": [],
        "screens": [],
        "matrices": []
      }
    ]
  }
}
```

---

### GET `/ec2/getSystemMergeHistory`

<p><b>Proprietary.</b></p>Return information about previous Site merges.

**Responses:**

**default**: 
```json
[
  {
    "timestamp": "string",
    "mergedSystemLocalId": "string",
    "mergedSystemCloudId": "string",
    "username": "string",
    "signature": "string"
  }
]
```

---

### POST `/ec2/notifyAnalyticsEngineActiveSettingChanged`

<p><b>Proprietary.</b></p>Notifies the Plugin when an Engine setting marked with `isActive: "true"` changes its value
in the GUI, so the Plugin can adjust the values of the settings and the Settings Model.

**Request Body:**

Content-Type: `application/json`

```json
{
  "analyticsEngineId": "89abcdef-0123-4567-89ab-cdef01234567",
  "activeSettingName": "",
  "settingsModel": {},
  "settingsValues": {},
  "paramValues": {}
}
```

*Required fields: `analyticsEngineId`, `activeSettingName`, `settingsModel`, `settingsValues`, `paramValues`*

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string",
  "reply": {
    "settingsValues": {},
    "settingsModel": {},
    "settingsErrors": {},
    "actionUrl": "string",
    "messageToUser": "string",
    "useProxy": false,
    "useDeviceCredentials": false
  }
}
```

---

### POST `/ec2/notifyDeviceAnalyticsActiveSettingChanged`

<p><b>Proprietary.</b></p>Notifies the Plugin when a DeviceAgent setting marked with `isActive: "true"` changes its
value in the GUI, so the Plugin can adjust the values of the settings and the Settings
Model.

**Request Body:**

Content-Type: `application/json`

```json
{
  "deviceId": "",
  "analyticsEngineId": "89abcdef-0123-4567-89ab-cdef01234567",
  "activeSettingName": ""
}
```

*Required fields: `deviceId`, `analyticsEngineId`, `activeSettingName`, `settingsValues`, `settingsModel`, `paramValues`*

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string",
  "reply": {
    "analyzedStreamIndex": "primary",
    "disableStreamSelection": false,
    "settingsErrors": {},
    "actionUrl": "string",
    "messageToUser": "string",
    "useProxy": false,
    "useDeviceCredentials": false
  }
}
```

---

### POST `/ec2/removeDiscoveryInformation`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "id": "89abcdef-0123-4567-89ab-cdef01234567",
  "url": "",
  "ignore": false
}
```

*Required fields: `id`, `url`, `ignore`*

**Responses:**

**default**: 

---

### POST `/ec2/runtimeInfoChanged`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "version": 0,
  "peer": {
    "id": "89abcdef-0123-4567-89ab-cdef01234567",
    "persistentId": "89abcdef-0123-4567-89ab-cdef01234567",
    "instanceId": "89abcdef-0123-4567-89ab-cdef01234567",
    "peerType": "PT_NotDefined",
    "dataFormat": "JsonFormat"
  },
  "platform": "",
  "box": "",
  "brand": "",
  "customization": "",
  "publicIP": "",
  "prematureLicenseExperationDate": "",
  "videoWallInstanceGuid": "89abcdef-0123-4567-89ab-cdef01234567",
  "videoWallControlSession": "89abcdef-0123-4567-89ab-cdef01234567",
  "hardwareIds": [
    ""
  ],
  "nx1mac": "",
  "nx1serial": "",
  "updateStarted": false,
  "userId": "89abcdef-0123-4567-89ab-cdef01234567",
  "flags": "MasterCloudSync",
  "activeAnalyticsEngines": [
    "{00000000-0000-0000-0000-000000000000}"
  ],
  "prematureVideoWallLicenseExpirationDate": "",
  "parentServerId": "89abcdef-0123-4567-89ab-cdef01234567",
  "tierGracePeriodExpirationDateMs": 0,
  "activeIntegrations": [
    "{00000000-0000-0000-0000-000000000000}"
  ]
}
```

*Required fields: `version`, `peer`, `platform`, `box`, `brand`, `customization`, `publicIP`, `prematureLicenseExperationDate`, `videoWallInstanceGuid`, `videoWallControlSession`, `hardwareIds`, `nx1mac`, `nx1serial`, `updateStarted`, `userId`, `flags`, `activeAnalyticsEngines`, `prematureVideoWallLicenseExpirationDate`, `parentServerId`, `tierGracePeriodExpirationDateMs`, `activeIntegrations`*

**Responses:**

**default**: 

---

### POST `/ec2/setResourceStatus`

<p><b>Proprietary.</b></p>Change a resource status.
<p>
The parameters should be passed as a JSON object in POST message body with content type
"application/json". An example of such object can be seen in an item of the array returned
by <code>GET /ec2/getStatusList</code>.
</p>

> **Permissions:** Power User or a custom user with "Edit camera settings" permission,
or a user who owns the Resource in case the Resource is a Layout.

**Request Body:**

Content-Type: `application/json`

```json
{
  "id": "89abcdef-0123-4567-89ab-cdef01234567",
  "status": "Offline"
}
```

*Required fields: `id`, `status`*

**Responses:**

**default**: 

---

### GET `/ec2/statistics`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 

---

### POST `/ec2/statistics`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 

---

### POST `/ec2/triggerStatisticsReport`

<p><b>Proprietary.</b></p>Initiate delivery of the Site statistics to the statistics server.

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string",
  "reply": {
    "systemId": "{00000000-0000-0000-0000-000000000000}",
    "url": "string",
    "status": "string"
  }
}
```

---

### POST `/ec2/videowallControl`

<p><b>Proprietary.</b></p>

**Request Body:**

Content-Type: `application/json`

```json
{
  "operation": 0,
  "videowallGuid": "89abcdef-0123-4567-89ab-cdef01234567",
  "instanceGuid": "89abcdef-0123-4567-89ab-cdef01234567"
}
```

*Required fields: `operation`, `videowallGuid`, `instanceGuid`, `params`*

**Responses:**

**default**: 

---

## Proprietary Server API (Legacy/Beta)

This group contains proprietary functions related to a single Server. For these functions no backward compatibility is guaranteed, and their use by third-party integrations is discouraged.

### GET `/api/debug`

<p><b>Proprietary.</b></p>Intended for debugging and experimenting.
<br/>ATTENTION: Works only if enabled by nx_vms_server.ini.

> **Permissions:** Administrator.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `crash` | query | `true` |  | Intentionally crashes the Server. |
| `fullDump` | query | `true` |  | If specified together with "crash", creates full crash dump. |
| `exit` | query | `true` |  | Terminates the Server normally, via "exit(64)". |
| `throwException` | query | `true` |  | Terminates the Server via throwing an exception. |
| `abort` | query | `true` |  | Terminates the Server via "abort()". |
| `delayS` | query | string |  | Sleep for the specified number of seconds, and then reply. |

**Responses:**

**default**: 

---

### GET `/api/debugEvent`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 

---

### POST `/api/debugEvent`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 

---

### GET `/api/downloads/status`

<p><b>Proprietary.</b></p>Retrieves the detailed status information for all files previously registered in the
Server's Downloader via POST /api/downloads/{fileName}.

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string",
  "reply": {
    "name": "string",
    "size": "string",
    "md5": "string",
    "url": "string",
    "chunkSize": "string",
    "status": "notFound",
    "peerPolicy": "none",
    "touchTime": "string",
    "ttl": "string",
    "additionalPeers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "absoluteDirectoryPath": "string",
    "fullFilePath": "string",
    "userData": "string"
  }
}
```

---

### DELETE `/api/downloads/{fileName}`

<p><b>Proprietary.</b></p>Deletes the record about the specified file previously registered in the Server's Downloader
via POST /api/downloads/{fileName}.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `deleteData` | query | boolean |  | If set to false, the actual file will not be deleted from the Server's filesystem. Default: true. |

**Responses:**

**default**: 

---

### PUT `/api/downloads/{fileName}`

<p><b>Proprietary.</b></p>Equivalent of POST /api/downloads/{fileName}.

**Responses:**

**default**: 

---

### POST `/api/downloads/{fileName}`

<p><b>Proprietary.</b></p>Registers the file in the Server's Downloader. Here {fileName} is an arbitrary identifier
for the file; it must be unique throughout the entire VMS Site, and is intended to be used
in further calls related to this file record.
<br/>
After registering, starts the download session for the file - the content for the file will
be downloaded by the Server from the Internet and/or other Servers in the Site which have
already downloaded certain chunks of the file.
<br/>
The file, when its content is obtained by the Server, can then be used for various purposes,
e.g. to create a Virtual Camera having the file content as its video archive.

**Request Body:**

Content-Type: `application/json`

```json
{
  "size": 0,
  "md5": "",
  "url": "",
  "peerPolicy": "none"
}
```

*Required fields: `url`*

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string"
}
```

---

### GET `/api/downloads/{fileName}/checksums`

<p><b>Proprietary.</b></p>Retrieves chunk checksums for the specified file previously registered in the Server's
Downloader via POST /api/downloads/{fileName}.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `extraFormatting` | query | `true` |  | <p><b>Proprietary.</b></p>If present and the requested result format is non-binary, indentation and spacing will be used to improve readability. |

**Responses:**

**default**: List of base64-encoded checksums for all chunks.
```json
[
  "string"
]
```

---

### GET `/api/downloads/{fileName}/chunks/{chunkIndex}`

<p><b>Proprietary.</b></p>Retrieves the binary content of the specified chunk ({chunkIndex} is zero-based) of the file
previously registered in the Server's Downloader via POST /api/downloads/{fileName}.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `fromInternet` | query | boolean |  | <p><b>Proprietary.</b></p>Whether the chunk should be downloaded from the internet and stored in the Server's Downloader. Default: false. |
| `url` | query | string |  | <p><b>Proprietary.</b></p>Must be specified if and only if fromInternet is true. |
| `chunkSize` | query | integer |  | <p><b>Proprietary.</b></p>Size of the chunk, in bytes, from 1 to 10485760 (10 MB). Must be specified if and only if fromInternet is true. |

**Responses:**

**default**: Content of the specified file chunk, as raw bytes.
```json
"string"
```

---

### POST `/api/downloads/{fileName}/chunks/{chunkIndex}`

<p><b>Proprietary.</b></p>Equivalent of PUT /api/downloads/{fileName}/chunks/{chunkIndex}.

**Responses:**

**default**: 

---

### PUT `/api/downloads/{fileName}/chunks/{chunkIndex}`

<p><b>Proprietary.</b></p>Sends to the Server the binary content of the specified chunk of the file previously
registered in the Server's Downloader via POST /api/downloads/{fileName}. Here {chunkIndex}
is zero-based, and the request body must contain the chunk bytes and must have
"Content-Type: application/octet-stream". To validate the upload, call
GET /api/downloads/{fileName}/status.

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string"
}
```

---

### GET `/api/downloads/{fileName}/status`

<p><b>Proprietary.</b></p>Retrieves the detailed status information for the specified file previously registered in
the Server's Downloader via POST /api/downloads/{fileName}.

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string",
  "reply": {
    "name": "string",
    "size": "string",
    "md5": "string",
    "url": "string",
    "chunkSize": "string",
    "status": "notFound",
    "peerPolicy": "none",
    "touchTime": "string",
    "ttl": "string",
    "additionalPeers": [
      "{00000000-0000-0000-0000-000000000000}"
    ],
    "absoluteDirectoryPath": "string",
    "fullFilePath": "string",
    "userData": "string"
  }
}
```

---

### PUT `/api/downloads/{fileName}?upload`

<p><b>Proprietary.</b></p>Equivalent of POST /api/downloads/{fileName}?upload.

**Responses:**

**default**: 

---

### POST `/api/downloads/{fileName}?upload`

<p><b>Proprietary.</b></p>Registers the file in the Server's Downloader. Here {fileName} is an arbitrary identifier
for the file; it must be unique throughout the entire VMS Site, and is intended to be used
in further calls related to this file record.
<br/>
After registering, starts the upload session for the file - the content for the file should
then be uploaded chunk-by-chunk via PUT /api/downloads/{fileName}/chunks/{chunkIndex}.
<br/>
The file, when its content is obtained by the Server, can then be used for various purposes,
e.g. to create a Virtual Camera having the file content as its video archive.

**Request Body:**

Content-Type: `application/json`

```json
{
  "size": 0,
  "md5": "",
  "chunkSize": 0,
  "ttl": 0,
  "recreate": false
}
```

*Required fields: `size`, `md5`, `chunkSize`*

**Responses:**

**default**: JSON object including the error status.
```json
{
  "errorId": "ok",
  "errorString": "string",
  "error": "string"
}
```

---

### GET `/api/transmitAudio`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 

---

### POST `/api/transmitAudio`

<p><b>Proprietary.</b></p>

**Responses:**

**default**: 

---

## Analytics API Callbacks

Documentation for Analytics API callbacks sent as JSON-RPC requests via websocket from Server to Integration.

**Request format:**
```json
{"id": <request_id>, "jsonrpc": "2.0", "method": "<method_name>", "params": <input_struct>}
```

**Success Response:**
```json
{"id": <request_id>, "jsonrpc": "2.0", "result": {"type": "ok", "data": <output_struct>}}
```

**Error Response:**
```json
{"id": <request_id>, "jsonrpc": "2.0", "result": {"type": "error", "error": {"errorCode": "<error_code>", "errorMessage": "<error_description>"}}}
```

Error codes: `noError`, `networkError`, `unauthorized`, `internalError`, `invalidParams`, `notImplemented`, `otherError`, `ioError`, `noData`

### Analytics Callbacks

### GET `/rest.v4.analytics.engines.settings.update`

**Update Engine settings**

Receives the values of settings stored in the Server database for the specified Engine
instance. Equivalent of `IEngine::setSettings()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `settingsValues` | query | string | ✓ | `string map`</br>  |

**Responses:**

**default**: Settings response, or an error.
```json
{
  "type": "ok",
  "data": {
    "settingsModel": {}
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.deviceAgents.settings.update`

**Update Device Agent settings**

Receives the values of settings stored in the Server database for the combination of the
specified Device and the specified Engine instance. Equivalent of
`IDeviceAgent::setSettings()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `settingsValues` | query | string | ✓ | `string map`</br>  |

**Responses:**

**default**: Settings response, or an error.
```json
{
  "type": "ok",
  "data": {
    "settingsModel": {}
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.settings.notifyActiveSettingChanged`

**Notify Engine about Active setting change**

When a setting marked as Active changes its value in the GUI, the Server calls this method
to notify the specified Engine instance, and allow it to adjust the values of the settings and
the Settings Model. Equivalent of `IEngine::getSettingsOnActiveSettingChange()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `activeSettingName` | query | string | ✓ |  |
| `settingsModel` | query | string | ✓ | `object`</br>  |
| `settingsValues` | query | string | ✓ | `string map`</br>  |
| `params` | query | string | ✓ | `string map`</br>  |

**Responses:**

**default**: Response to the action, or an error.
```json
{
  "type": "ok",
  "data": {
    "actionResponse": {
      "actionUrl": "string",
      "messageToUser": "string",
      "useProxy": false,
      "useDeviceCredentials": false
    },
    "settingsResponse": {
      "settingsModel": {}
    }
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.deviceAgents.settings.notifyActiveSettingChanged`

**Notify Device Agent about Active setting change**

When a setting marked as Active changes its value in the GUI, the Server calls this method
to notify the combination of the specified Device and the specified Engine instance, and allow
it to adjust the values of the settings and the Settings Model. Equivalent of
`IConsumingDeviceAgent::getSettingsOnActiveSettingChange()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `activeSettingName` | query | string | ✓ |  |
| `settingsModel` | query | string | ✓ | `object`</br>  |
| `settingsValues` | query | string | ✓ | `string map`</br>  |
| `params` | query | string | ✓ | `string map`</br>  |

**Responses:**

**default**: Response to the action, or an error.
```json
{
  "type": "ok",
  "data": {
    "actionResponse": {
      "actionUrl": "string",
      "messageToUser": "string",
      "useProxy": false,
      "useDeviceCredentials": false
    },
    "settingsResponse": {
      "settingsModel": {}
    }
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.integrationSideSettings.get`

**Get Engine's Integration-side settings**

In addition to the settings stored in the Server database, a specified Engine instance can have
some settings which are stored somewhere "under the hood" of the Engine, e.g. on a device
acting as an Engine backend. Such settings do not need to be explicitly marked in the
Settings Model, but every time the Server offers the user to edit the values, it calls this
method and merges the received values with the ones in its database. Equivalent of
`IEngine::integrationSideSettings()`.

**Responses:**

**default**: Settings response, or an error.
```json
{
  "type": "ok",
  "data": {
    "settingsModel": {}
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.deviceAgents.integrationSideSettings.get`

**Get Device Agent's Integration-side settings**

In addition to the settings stored in the Server database, the combination of the specified
Device and the specified Engine instance can have some settings which are stored somewhere
"under the hood" of the Engine, e.g. on a Device acting as an Engine backend. Such settings
do not need to be explicitly marked in the Settings Model, but every time the Server offers
the user to edit the values, it calls this method and merges the received values with the ones
in its database. Equivalent of `IDeviceAgent::integrationSideSettings()`.

**Responses:**

**default**: Settings response, or an error.
```json
{
  "type": "ok",
  "data": {
    "settingsModel": {}
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.executeAction`

**Execute Engine action**

Called when some Object Action defined by the specified Engine instance is triggered by Server.
Equivalent of `IEngine::executeAction()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `actionId` | query | string | ✓ |  |
| `objectTrackId` | query | string(uuid) | ✓ |  |
| `deviceId` | query | string(uuid) | ✓ |  |
| `objectTrackInfo` | query | string | ✓ | `object`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>titleText</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>titleImageData</b> `string`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>titleImageDataSize</b> `integer`</br> &nbsp;&nbsp;&nbsp;&nbsp;<b>titleImageDataFormat</b> `string`</br>  |
| `timestampUs` | query | string | ✓ |  |
| `params` | query | string | ✓ | `string map`</br>  |

**Responses:**

**default**: Action response, or an error.
```json
{
  "type": "ok",
  "data": {
    "actionUrl": "string",
    "messageToUser": "string",
    "useProxy": false,
    "useDeviceCredentials": false
  },
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.deviceAgents.create`

**Create Device Agent**

Asks the specified Engine instance to create a new, or return an existing DeviceAgent
instance intended to work with the given Device. Equivalent of `IEngine::obtainDeviceAgent()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | query | string(uuid) | ✓ |  |
| `vendor` | query | string | ✓ |  |
| `model` | query | string | ✓ |  |
| `firmware` | query | string | ✓ |  |
| `name` | query | string | ✓ |  |
| `url` | query | string | ✓ |  |
| `login` | query | string | ✓ |  |
| `password` | query | string | ✓ |  |
| `sharedId` | query | string | ✓ |  |
| `logicalId` | query | string | ✓ |  |
| `channelNumber` | query | integer | ✓ |  |

**Responses:**

**default**: Response, or an error.
```json
{
  "type": "ok",
  "data": {},
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.create`

**Create Engine**

Asks an Integration to create a new instance of the Analytics Engine. Equivalent of
`IIntegration::createEngine()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `engineId` | query | string(uuid) | ✓ |  |

**Responses:**

**default**: Response, or an error.
```json
{
  "type": "ok",
  "error": {
    "errorCode": "noError",
    "errorMessage": "string"
  }
}
```

---

### GET `/rest.v4.analytics.engines.compatibilityInfo.get`

**Get Engine compatibility info**

Returns true if the specified Engine instance is able to create DeviceAgents for the provided
Device, false otherwise. Equivalent of `IEngine::isCompatible()`.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | query | string(uuid) | ✓ |  |
| `vendor` | query | string | ✓ |  |
| `model` | query | string | ✓ |  |
| `firmware` | query | string | ✓ |  |
| `name` | query | string | ✓ |  |
| `url` | query | string | ✓ |  |
| `login` | query | string | ✓ |  |
| `password` | query | string | ✓ |  |
| `sharedId` | query | string | ✓ |  |
| `logicalId` | query | string | ✓ |  |
| `channelNumber` | query | integer | ✓ |  |

**Responses:**

**default**: Compatibility info
```json
{
  "isCompatible": false
}
```

---

### GET `/rest.v4.analytics.engines.deviceAgents.delete`

**Delete Device Agent**

Notifies the combination of the specified Device and the specified Engine instance about the
necessity to delete the Device Agent.

**Responses:**

**default**: 

---

### POST `/rest.v4.analytics.subscribe`

**Subscribe**

ATTENTION: This is not actually a callback from the Server to the Integration, but rather the
only JSON-RPC request from the Integration to the Server.
<br/>
Used by the Integration to subscribe to the Server requests and notifications. Until the
Integration sends this request, it will not receive any requests from the Server.

**Responses:**

**default**: 

---

## Event Schemas Reference

These schemas are used in Events and other API responses.

### QnCameraAdvancedParamGroup

```json
{
  "name": "string",
  "description": "string",
  "aux": "string",
  "params": [
    {
      "id": "string",
      "dataType": "None",
      "range": "string",
      "name": "string",
      "description": "string",
      "confirmation": "string",
      "actionName": "string",
      "tag": "string",
      "availableInOffline": false,
      "readOnly": false,
      "readCmd": "string",
      "writeCmd": "string",
      "internalRange": "string",
      "aux": "string",
      "dependencies": [
        {}
      ],
      "showRange": false,
      "compact": false,
      "unit": "string",
      "notes": "string",
      "resync": false,
      "keepInitialValue": false,
      "bindDefaultToMinimum": false,
      "group": "string"
    }
  ],
  "groups": [
    {
      "name": "string",
      "description": "string",
      "aux": "string",
      "params": [
        {}
      ],
      "groups": [
        "<QnCameraAdvancedParamGroup>"
      ]
    }
  ]
}
```

### Analytic

Triggered when an analytics event is triggered on source device.

```json
{
  "attributes": "example string",
  "caption": {
    "checkType": "inList",
    "value": "example string"
  },
  "description": {
    "checkType": "inList",
    "value": "example string"
  },
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "eventTypeId": {
    "typeId": "nx.lineCrossing"
  },
  "state": "stopped",
  "type": "analytics"
}
```

### AnalyticsObject

Triggered when an analytics object is detected on source device. This event is specific to video analytics that provide object detection metadata, enabling accurate categorization based on the object type

```json
{
  "attributes": {
    "checkType": "inList",
    "value": "example string"
  },
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "objectTypeId": "nx.base.Bird",
  "state": "stopped",
  "type": "analyticsObject"
}
```

### Bookmark

Create Bookmark

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "durationS": 10,
  "recordAfterS": 10,
  "recordBeforeS": 10,
  "tags": "example string",
  "type": "bookmark"
}
```

### CameraInput

Triggered when an input signal is detected on one or more devices.

```json
{
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "inputPortId": "example string",
  "state": "stopped",
  "type": "cameraInput"
}
```

### DesktopNotification

Show Desktop Notification

```json
{
  "acknowledge": true,
  "intervalS": 10,
  "type": "desktopNotification",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  }
}
```

### DeviceDisconnected

Triggered when a device is disconnected, regardless of the cause.

```json
{
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "type": "deviceDisconnected"
}
```

### DeviceIpConflict

Triggered when a conflict occurs due to another device entering the network with the same IP address, causing one of the devices to go offline

```json
{
  "type": "deviceIpConflict"
}
```

### DeviceOutput

Modify the output state of the device

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "durationS": 10,
  "outputPortId": "example string",
  "type": "deviceOutput"
}
```

### DeviceRecording

Start device recording

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "durationS": 10,
  "fps": 123,
  "intervalS": 10,
  "quality": "highest",
  "recordAfterS": 10,
  "recordBeforeS": 10,
  "type": "deviceRecording"
}
```

### EnterFullscreen

Expand given camera to fullscreen mode if it is displayed on the current layout.

```json
{
  "devices": {
    "id": "89abcdef-0123-4567-89ab-cdef01234567",
    "useSource": true
  },
  "layoutIds": [
    "89abcdef-0123-4567-89ab-cdef01234567"
  ],
  "playbackTimeS": 10,
  "type": "enterFullscreen"
}
```

### ExitFullscreen

Exit fullscreen mode for the specified layouts for all users if it is currently displayed.

```json
{
  "layoutIds": [
    "89abcdef-0123-4567-89ab-cdef01234567"
  ],
  "type": "exitFullscreen"
}
```

### Generic

Triggered when the server receives a request to <code>/rest/v4/events/generic</code> from an external resource.

```json
{
  "caption": {
    "checkType": "inList",
    "value": "example string"
  },
  "description": {
    "checkType": "inList",
    "value": "example string"
  },
  "omitLogging": true,
  "source": {
    "checkType": "inList",
    "value": "example string"
  },
  "state": "stopped",
  "type": "generic"
}
```

### Http

Send HTTP(S) request.

```json
{
  "auth": {
    "authType": "authBasic",
    "login": "example string",
    "password": "example string",
    "token": "example string"
  },
  "content": "Event {event.name} occurred at {event.time} on {device.name}.",
  "contentType": "application/json",
  "headers": [
    "{\"key\": \"headerName\", \"value\": \"headerValue\"}"
  ],
  "intervalS": 10,
  "method": "POST",
  "type": "http",
  "url": "http://exampleServer/rest/v4/login/users/{user.name}"
}
```

### IntegrationDiagnostic

Triggered when an event is received from a plugin device connected to the site.

```json
{
  "caption": {
    "checkType": "inList",
    "value": "example string"
  },
  "description": {
    "checkType": "inList",
    "value": "example string"
  },
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "engineId": "89abcdef-0123-4567-89ab-cdef01234567",
  "level": "warning",
  "type": "integrationDiagnostic"
}
```

### LdapSyncIssue

Triggered when the LDAP server fails to synchronize with the site.

```json
{
  "type": "ldapSyncIssue"
}
```

### LicenseIssue

Triggered when a trial license expires or when the server with activated licenses goes offline.

```json
{
  "type": "licenseIssue"
}
```

### Motion

Triggered when motion is detected on the selected cameras. Note: recording must be enabled for the rule to function.

```json
{
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "state": "stopped",
  "type": "motion"
}
```

### NetworkIssue

Triggered when data transfer between the device and server fails, and packet loss is detected.

```json
{
  "type": "networkIssue"
}
```

### OpenLayout

```json
{
  "intervalS": 10,
  "layoutId": "89abcdef-0123-4567-89ab-cdef01234567",
  "playbackTimeS": 10,
  "type": "openLayout",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  }
}
```

### PanicRecording

Panic Recording mode switches recording settings for all cameras to maximum FPS and quality.

```json
{
  "durationS": 10,
  "intervalS": 10,
  "type": "panicRecording"
}
```

### PlaySound

Play sound on the specified device(s) and display desktop notification.

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "intervalS": 10,
  "sound": "bycyclebell.mp3",
  "type": "playSound",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "volume": 0.5
}
```

### PtzPreset

Execute PTZ Preset to all users.

```json
{
  "devices": {
    "id": "89abcdef-0123-4567-89ab-cdef01234567",
    "useSource": true
  },
  "intervalS": 10,
  "presetId": "example string",
  "type": "ptzPreset"
}
```

### PushNotification

Sends a mobile notification via the cloud.

```json
{
  "caption": "Event {event.name} occurred at {event.time} on {device.name}.",
  "description": "Event {event.name} occurred at {event.time} on {device.name}.",
  "intervalS": 10,
  "type": "pushNotification",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  }
}
```

### RepeatSound

Play sound repeatedly on the specified device(s) and display desktop notification.

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "sound": "bycyclebell.mp3",
  "type": "repeatSound",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "volume": 0.5
}
```

### SendEmail

```json
{
  "emails": "example string",
  "intervalS": 10,
  "type": "sendEmail",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  }
}
```

### ServerCertificateError

Triggered when the SSL certificate cannot be verified.

```json
{
  "type": "serverCertificateError"
}
```

### ServerConflict

Triggered when multiple servers on the same network access the same devices.

```json
{
  "type": "serverConflict"
}
```

### ServerFailure

Triggered when a server goes down due to hardware failure, software issue, or manual/emergency shutdown.

```json
{
  "type": "serverFailure"
}
```

### ServerStarted

Triggered when any server registered in the server starts.

```json
{
  "type": "serverStarted"
}
```

### ShowOnAlarmLayout

Put the given device(s) to the Alarm Layout.

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "forceOpen": true,
  "intervalS": 10,
  "playbackTimeS": 10,
  "type": "showOnAlarmLayout",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  }
}
```

### SiteHttp

Send HTTPS request to the site.

```json
{
  "content": "Event {event.name} occurred at {event.time} on {device.name}.",
  "endpoint": "Event {event.name} occurred at {event.time} on {device.name}.",
  "intervalS": 10,
  "method": "POST",
  "type": "siteHttp"
}
```

### SoftTrigger

This event adds a button to one or more devices in the layout. When clicked, it triggers the associated action either instantly or continuously (while held). Soft trigger buttons appear as a circular overlay in the bottom-right corner of the item and display the <code>triggerName</code> field on hover.

```json
{
  "devices": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "triggerIcon": "_bell_on",
  "triggerId": "89abcdef-0123-4567-89ab-cdef01234567",
  "triggerName": "example string",
  "type": "softTrigger",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  }
}
```

### Speak

Speak text on specified resource(s).

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "intervalS": 10,
  "text": "Event {event.name} occurred at {event.time} on {device.name}.",
  "type": "speak",
  "users": {
    "acceptAll": true,
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ]
  },
  "volume": 0.5
}
```

### StorageIssue

Triggered when the server fails to write data to one or more storage devices.

```json
{
  "type": "storageIssue"
}
```

### TextOverlay

Displays a text overlay on layout items for specified devices.

```json
{
  "devices": {
    "ids": [
      "89abcdef-0123-4567-89ab-cdef01234567"
    ],
    "useSource": true
  },
  "durationS": 10,
  "text": "Event {event.name} occurred at {event.time} on {device.name}.",
  "type": "textOverlay"
}
```

### WriteToLog

Write a record to the site's log.

```json
{
  "intervalS": 10,
  "type": "writeToLog"
}
```

