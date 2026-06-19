# 官方文书接入说明

## 已接入的后端接口

- `GET /api/admin/official-sources`：查看官方源配置状态、注册入口、最近检查时间。
- `POST /api/official-documents/run`：运行官方文书抓取。当前优先接入 Judilibre；无凭证时会返回 `needs_credentials`，不会影响系统运行。
- `GET /api/documents`：查看已归档官方文书。
- `POST /api/documents/capture`：手动归档指定 URL 的官方文书、PDF、HTML 或 JSON。

## Judilibre

用途：法国司法裁判开放数据，优先用于法国 AI 版权诉讼、SACD、Le Figaro、SGDL、SNE、SNAC 相关关键词的官方文书命中。

注册入口：https://www.data.gouv.fr/dataservices/api-judilibre

配置方式：

1. 复制 `config/official-sources.example.json` 为 `config/official-sources.local.json`。
2. 如果 PISTE 后台给的是 `KeyId`，填写 `judilibre.key_id`；系统会自动以 `KeyId` 请求头发送。
3. 如果 PISTE 给的是现成 bearer token，将 `judilibre.bearer_token` 改成授权 token。
4. 如果 PISTE 给的是 application OAuth 凭证，而不是现成 bearer token，填写 `token_url`、`client_id`、`client_secret`、`scope`。不要把这些值提交到 Git。
5. 如注册后台给出的 endpoint 与默认值不同，修改 `judilibre.search_url`。
6. 在后台点击“运行官方文书抓取”，或请求 `POST /api/official-documents/run`。

命中结果：

- 写入 `documents`，标记为 `confidence=official`。
- 自动生成一张 `status=review` 的官方文书情报卡片，等待后台审核后发布到前端。

认证方式：

- 直接 token：填写 `bearer_token`。
- PISTE KeyId：填写 `key_id`，或在 Render 环境变量里设置 `JUDILIBRE_KEY_ID`。
- OAuth application flow：填写 `token_url`、`client_id`、`client_secret`。默认用 form body 发送 client 凭证；如果 PISTE 要求 HTTP Basic，把 `auth_style` 改为 `basic`。

## Légifrance

用途：法国官方法律信息和判例补充源。当前已在源目录和配置文件中预留，但抓取 endpoint 需要你注册后确认权限和路径。

注册入口：https://developer.aife.economie.gouv.fr

## EUR-Lex

用途：欧盟法规、AI Act、版权执行、CJEU/EU 法源基线。当前已可作为官方归档源，后续可增强 Web Service/SPARQL 检索。

入口：https://eur-lex.europa.eu/

## CURIA / CJEU

用途：欧盟法院和普通法院案件、意见、新闻稿。当前已列入官方入口源，后续可接入案件检索或新闻稿/RSS。

入口：https://curia.europa.eu/
