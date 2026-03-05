import moraBase from './moraBase.js';
import commonTools from './commonTools.js';
import moracfg from './config.js';
import gsCfg from '../../genshin/model/gsCfg.js';
import _ from 'lodash';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './setting.js'
const _path = process.cwd();

export default class roleGuide extends moraBase {

    /**
     * 获取 OSS 参数（使用 getter 确保每次获取最新配置）
     * 支持热加载：配置文件修改后自动生效
     */
    get oss() {
        const config = moracfg.getConfigWithCache(moracfg.user, 'config')
        return config.ossParams
    }

    constructor(e) {
        super(e)
        this.url = 'https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&order_type=2&collection_id='
        this.game = this.e.game || 'gs'

        this.isSr = this.game === 'sr'
        const configName = `${this.game === 'gs' ? 'r' : `${this.game}R`}oleGuides`

        // 先读取 user 目录获取 all 开关状态
        let userConfig = moracfg.getfileYaml(moracfg.user, configName)
        // 处理 all 值（支持 true/false/1/0）
        const allEnabled = userConfig && (userConfig.all === true || userConfig.all === 1 || userConfig.all === 'true')

        // 根据 all 开关决定读取哪个目录的配置
        // all: true  -> 读取 default 目录（使用默认攻略）
        // all: false -> 读取 user 目录（使用自定义攻略）
        let rawConfig
        if (allEnabled) {
            logger.log(`[${this.game}] all=true，读取 default 目录默认攻略`)
            rawConfig = moracfg.getfileYaml(moracfg.def, configName)
        } else {
            logger.log(`[${this.game}] all=false，读取 user 目录自定义攻略`)
            rawConfig = userConfig
        }

        // 处理配置格式：原神是 {olds, news}，星铁/绝区零新格式是 {ALL, list}
        if (this.game === 'gs') {
            this.uploader = rawConfig
        } else {
            // 星铁/绝区零：支持新格式 {ALL, list} 和旧格式（直接数组）
            if (rawConfig && Array.isArray(rawConfig.list)) {
                this.uploader = rawConfig.list
            } else if (Array.isArray(rawConfig)) {
                this.uploader = rawConfig
            } else {
                this.uploader = []
            }
        }
        this.resPath = moracfg.getMoraPlus(this.game, 'role')
        this.path = `${moracfg.getMoraPath('data')}roleGuides`
    }

    async strategies(name, isUpdate) {
        let role = gsCfg.getRole(name)
        if (!role) return false

        //  适配多属性主角别名

        //    从本地文件加载别名数据
        async function loadAliases() {
            const filePath = path.join(`${_path}/plugins/mora-plugin/resources/mora-plugin-res/moraothername/gsalias.json`); // JSON 文件的路径
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                logger.error('Failed to load aliases:', error);
                return {}; // 返回空对象作为兜底
            }
        }//    从本地文件加载别名数据


        async function getFormalName(role) {        // 根据传入的值查找对应的正式名称
            const defAlias = await loadAliases();
            for (const [key, aliases] of Object.entries(defAlias)) {            // 遍历键值对
                if (aliases.includes(role)) {                // 如果传入的值在别名列表中，返回对应的键
                    return key;
                }
            }
            return role;            // 如果没有找到匹配的键或值，返回原始值
        }

        role.name = await getFormalName(name);

        let guide = _.concat(this.uploader.news, this.uploader.olds)
        let dir = this.dirPath(role.name, '', '', this.game)

        // 查找存在的 atlas 文件（支持多种扩展名和大小写）
        const atlasPaths = []
        for (const dir of ['Atlas', 'atlas']) {
            for (const ext of ['png', 'jpg', 'webp']) {
                atlasPaths.push(`${_path}/plugins/${dir}/Genshin-Atlas/material for role/${role.name}.${ext}`)
            }
        }
        let atlas = this.findExistingPath(atlasPaths)
        let msg = []

        if (atlas) {
            msg.push(atlas)
        }
        let xf = true
        for (let i in dir) {
            let success = true
            if (!fs.existsSync(dir[i]) || (isUpdate && !dir[i].includes('/add_ons/'))) {
                success = await this.getImg(role.name, guide[i], dir[i])
            }
            if (success) {
                if (_.includes(dir[i], `${this.resPath}/Guides`) && _.includes(dir[i], role.name)) {
                    xf = false
                }
                if (!xf && _.includes(dir[i], `/1/${role.name}`)) {
                    continue
                }
                msg.push(dir[i])
            }
        }

        msg = _.map(_.uniq(msg), v => segment.image(v))
        return await this.replyStrategies(msg, role.name)
    }

    async srStrategies(name, isUpdate) {
        let role = {}

        /** 主角 */
        let trailblazer = commonTools.trailblazer(name, '攻略')
        if (trailblazer) {
            if (!trailblazer.name) {
                await this.e.reply(trailblazer)
                return
            } else role = trailblazer
        }

        //     if (_.isEmpty(role)) role = gsCfg.getRole(name, '', this.isSr)
        //     if (!role) return false

        //     从本地文件加载别名数据
        async function loadAliases() {
            const filePath = path.join(`${_path}/plugins/mora-plugin/resources/mora-plugin-res/moraothername/sralias.json`); // JSON 文件的路径
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                logger.error('Failed to load aliases:', error);
                return role; // 返回空对象作为兜底
            }
        }

        async function getFormalName(role) {        // 根据传入的值查找对应的正式名称
            const defAlias = await loadAliases();
            for (const [key, aliases] of Object.entries(defAlias)) {            // 遍历键值对
                if (aliases.includes(role)) {     // 如果传入的值在别名列表中，返回对应的键
                    return key;
                }
            }
            return role;    // 如果没有找到匹配的键或值，返回原始值
        }
        role.name = await getFormalName(name);   // 获取正式名称并赋值给 role.name

        // 查找存在的 star-rail-atlas 文件（支持多种扩展名和大小写）
        const srAtlasPaths = []
        for (const dir of ['Atlas', 'atlas']) {
            for (const ext of ['png', 'jpg', 'webp']) {
                srAtlasPaths.push(`${_path}/plugins/${dir}/star-rail-atlas/material for role/${role.name}.${ext}`)
                srAtlasPaths.push(`${_path}/plugins/${dir}/star-rail-atlas/material for role/${role.roleId}.${ext}`)
                srAtlasPaths.push(`${_path}/plugins/${dir}/star-rail-atlas/guide for role/${role.name}.${ext}`)
                srAtlasPaths.push(`${_path}/plugins/${dir}/star-rail-atlas/guide for role/${role.roleId}.${ext}`)
            }
        }
        let atlas = this.findExistingPath(srAtlasPaths)

        let msg = []
        if (atlas) {
            msg.push(atlas)
            this.uploader = _.filter(this.uploader, v => v.source !== '听语惊花')
        }

        let sources = _.map(this.uploader, 'source')
        let dir = _.map(sources, v => `${this.path}/${v}/StarRail/${role.name}.jpg`)

        for (let i in dir) {
            let success = true
            if (!fs.existsSync(dir[i]) || isUpdate) {
                success = await this.getImg(role.name, this.uploader[i], dir[i], (role.reg || ''))
            }
            if (success) msg.push(dir[i])
        }

        msg = _.map(_.uniq(_.concat(msg)), v => segment.image(v))
        return await this.replyStrategies(msg, role.name)
    }

    async zzzStrategies(name, isUpdate) {
        let role = {};

        //       从本地文件加载别名数据
        async function loadAliases() {
            const filePath = path.join(`${_path}/plugins/mora-plugin/resources/mora-plugin-res/moraothername/zzzalias.json`); // JSON 文件的路径
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                logger.error('Failed to load aliases:', error);
                return role; // 返回空对象作为兜底
            }
        }        //       从本地文件加载别名数据

        async function getFormalName(role) {        // 根据传入的值查找对应的正式名称
            const defAlias = await loadAliases();
            for (const [key, aliases] of Object.entries(defAlias)) {            // 遍历键值对
                if (aliases.includes(role)) {     // 如果传入的值在别名列表中，返回对应的键
                    return key;
                }
            }
            return role;    // 如果没有找到匹配的键或值，返回原始值
        }
        role.name = await getFormalName(name);   // 获取正式名称并赋值给 role.name

        let msg = []
        // 查找存在的 zzz-atlas 文件（支持多种扩展名和大小写）
        const zzzAtlasPaths = []
        for (const dir of ['Atlas', 'atlas']) {
            for (const ext of ['png', 'jpg', 'webp']) {
                zzzAtlasPaths.push(`${_path}/plugins/${dir}/zzz-atlas/material for role/${role.name}.${ext}`)
            }
        }
        let atlas = this.findExistingPath(zzzAtlasPaths)
        let remove = '角色材料'
        if (atlas) {
            msg.push(atlas)
            this.uploader = _.filter(this.uploader, v => v.source !== remove)
        }

        let sources = _.map(this.uploader, 'source')
        let dir = _.map(sources, v => `${this.path}/${v}/ZenlessZoneZero/${role.name}.jpg`)

        for (let i in dir) {
            let success = true
            if (!fs.existsSync(dir[i]) || isUpdate) {
                success = await this.getImg(role.name, this.uploader[i], dir[i], (role.reg || ''))
            }
            if (success) msg.push(dir[i])
        }

        msg = _.map(_.uniq(_.concat(msg)), v => segment.image(v))
        return await this.replyStrategies(msg, role.name)
    }
    async replyStrategies(msg, name) {
        const zones = {
            gs: '原神',
            sr: '星铁',
            zzz: '绝区零'
        }
        if (_.isEmpty(msg)) {
            await this.e.reply(`${zones[this.game]} 暂无角色 ${name} 的攻略数据\n角色名正确吗？前缀符号正确吗？\n原神攻略发送 #胡桃攻略\n星铁攻略发送 *流萤攻略\n绝区零攻略发送 %柳攻略\n\n原神主角攻略发送 #风主攻略 #火主攻略`, false, { at: false, recallMsg: 30 })
            return false
        }

        return await commonTools.makeMsg(this.e, msg, `${name}攻略 来啦~ \n（mora-plugin-fork 提供）\n仓库：https://gitee.com/mingdiandianzhu/data`)
    }

    async getHelp() {
        this.resPath += this.isSr ? '/RefStat' : '/YieldCurve'
        await this.checkPath(this.resPath)

        let msg = [segment.image(`file://${this.resPath}/帮助.png`)]
        if (this.isSr) {
            msg.push('请使用【*希儿参考面板】或【#星铁罗刹参考面板】进行使用')
        } else {
            msg.push('角色默认配置：五星0命，四星满命，天赋满级')
            msg.push('曲线详细帮助：\n收益曲线说明书：https://www.miyoushe.com/ys/article/28119112\n《属性收益论》：https://www.miyoushe.com/ys/article/34217426\n《属性收益论》附录：https://www.miyoushe.com/ys/article/35015246')
        }

        return msg
    }

    async stat_curve(name) {
        await this.checkPath(this.resPath)

        let refPath = `${this.resPath}/RefStat`
        let curvePath = `${this.resPath}/YieldCurve`

        let role = {}
        /** 星铁主角特殊处理 */
        if (this.isSr) {
            let trailblazer = commonTools.trailblazer(name, '参考面板')
            if (trailblazer) {
                if (!trailblazer.name) {
                    await this.e.reply(trailblazer)
                    return
                } else role = trailblazer
            }
        }

        if (_.isEmpty(role)) role = gsCfg.getRole(name, '', this.isSr)
        if (!role) return false
        /** 主角特殊处理 */
        if (commonTools.travelerID.includes(Number(role.roleId))) {
            let traveler = commonTools.traveler(role.alias, name, '进阶参考')
            if (_.isEqual(role.alias, traveler)) {
                role.name = traveler
            } else {
                await this.e.reply(traveler)
                return
            }
        }

        let ref = fs.readdirSync(refPath)
        ref = _.filter(ref, v => _.includes(v, role.name))
        let curve = fs.existsSync(curvePath) ? fs.readdirSync(curvePath) : []
        curve = _.filter(curve, v => _.includes(v, role.name))
        if (_.isEmpty(ref) && _.isEmpty(curve)) {
            await this.e.reply(`暂无${role.name}进阶参考捏`)
            return
        }

        ref = _.map(ref, v => segment.image(`file://${refPath}/${v}`))
        curve = _.map(curve, v => segment.image(`file://${curvePath}/${v}`))
        let msg = [...ref, 'arti', ...curve]

        let notes = this.advancedInfo(role.name)
        let idx = _.findIndex(msg, i => _.isEqual(i, 'arti'))
        msg[idx] = notes.arti ? `圣遗物思路推荐：\n${notes.arti}` : ''
        if (!_.isEmpty(notes?.brief)) msg.push(`【蓝佬小课堂】：\n${notes.brief}`)
        msg[0] = _.compact([msg[0], notes.url])
        msg = _.compact(msg)

        return await commonTools.makeMsg(this.e, msg, `${role.name}进阶参考 @blue菌hehe`)
    }

    // 找本地图片
    findPack(path, name, game = '') {
        const gameDir = {
            gs: '/GenshinImpact',
            sr: '/StarRail',
            zzz: '/ZenlessZoneZero'
        }
        if (!fs.existsSync(path)) return []
        let _sources = fs.readdirSync(path)
        let dir = []
        _.each(_sources, author => {
            let _author = path.includes('add_ons') ? `${path}/${author}${gameDir[game]}` : `${path}/${author}`
            let _roles = fs.existsSync(_author) ? fs.readdirSync(_author) : []
            _roles = _.filter(_roles, r => _.includes(r, name))
            let au_path = _.isEmpty(_roles) ? false : `${_author}/${_roles[0]}`
            dir.push(au_path)
        })

        dir = _.compact(dir)
        return dir
    }

    /** 路径处理 */
    dirPath(name, res, add, game = '') {
        // 适配miaoYZ
        let defpath = `${_path}/temp/strategy/`
        if (!fs.existsSync(defpath)) {
            defpath = `${_path}/data/strategy/`
        }

        let olds = _.map(this.uploader.olds, (v) => v.source)
        let news = _.map(this.uploader.news, (v) => v.source)
        let dir = _.take(fs.readdirSync(defpath), 4)

        // 游戏目录映射
        const gameDir = {
            gs: 'GenshinImpact',
            sr: 'StarRail',
            zzz: 'ZenlessZoneZero'
        }
        const subDir = gameDir[game] || ''

        let _dir = []
        // news
        _.each(news, (n) => {
            let npath = subDir ? `${this.path}/${n}/${subDir}/${name}.jpg` : `${this.path}/${n}/${name}.jpg`
            _.each(res, (r) => {
                if (_.includes(r, n)) {
                    npath = r
                }
            })
            _dir.push(npath)
        })
        // olds
        _.each(olds, (o, idx) => {
            let _def = `${defpath}${idx + 1}/${name}.jpg`
            _.each(add, (a) => {
                if (_.includes(a, o)) {
                    _def = a
                }
            })
            _dir.push(_def)
        })

        dir = _.concat(_dir, add)
        dir = _.uniq(dir)
        return dir
    }

    advancedInfo(name) {
        let artiRef = moracfg.getfileYaml(`${this.resPath}/RefStat/`, 'RefNotes')
        let arti = artiRef[name] || {}
        let notes = { url: artiRef.url, arti: false }
        if (!_.isEmpty(arti)) {
            notes.arti = `主词条：${arti.mainProp}\n副词条：${arti.viceProp}`
            notes.brief = arti.brief
        }
        return notes
    }

    /**
     * 下载攻略图
     * 优化：优先从本地 strategy 目录下的作者 json 文件里取 url，
     * 如果找不到或下载失败，才回退到米游社接口抓取。
     * @param {String} name 角色名
     * @param {Object} author 作者（必须包含 source、collection_id 等）
     */
    async getImg(name, author, sfPath, filter = '') {
        // helper: 从本地 strategy JSON 目录中查找作者对应的 url 并下载
        const tryLocalStrategy = async () => {
            try {
                const strategyDir = path.join(`${_path}/plugins/mora-plugin/resources/mora-plugin-res/strategy`)
                if (!fs.existsSync(strategyDir)) return null

                const files = fs.readdirSync(strategyDir).filter(f => f.endsWith('.json'))
                // 游戏类型映射
                const gameKeyMap = {
                    'gs': 'GenshinImpact',
                    'sr': 'StarRail',
                    'zzz': 'ZenlessZoneZero'
                }
                const gameKey = gameKeyMap[this.game] || 'GenshinImpact'

                for (const file of files) {
                    const fp = path.join(strategyDir, file)
                    let content
                    try {
                        content = fs.readFileSync(fp, 'utf8')
                    } catch (err) {
                        logger.warn(`读取本地策略文件失败：${fp}，跳过。错误：${err}`)
                        continue
                    }
                    let json
                    try {
                        json = JSON.parse(content)
                    } catch (err) {
                        logger.warn(`解析本地策略 JSON 失败：${fp}，跳过。错误：${err}`)
                        continue
                    }

                    // json 里的顶层 key 预期为作者名（例如 "HoYo青枫"）
                    for (const [authorKey, authorVal] of Object.entries(json)) {
                        if (!authorKey) continue
                        // 必须匹配作者名，保证作者正确
                        if (!author || authorKey !== author.source) continue

                        // authorVal 结构预期包含 gameKey ('GenshinImpact' / 'StarRail' / 'ZenlessZoneZero') -> array of {name, link}
                        const list = (authorVal && authorVal[gameKey]) || []
                        if (!Array.isArray(list)) continue

                        // 尝试精确匹配 name > 包含匹配作为降级
                        let entry = list.find(i => i.name === name)
                        if (!entry) entry = list.find(i => i.name && i.name.includes(name))

                        if (entry && entry.link) {
                            // 拼接 OSS 参数优化图片下载
                            const downloadUrl = entry.link + this.oss
                            // 找到匹配项，下载图片
                            logger.mark(`${this.e.logFnc} 从本地策略文件(${author.source})获取 ${name} 的图片，下载地址：${downloadUrl}`)

                            // 确保目录存在
                            const dir = path.dirname(sfPath)
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true })
                            }

                            // 下载图片
                            try {
                                const response = await fetch(downloadUrl)
                                if (response.ok) {
                                    const arrayBuffer = await response.arrayBuffer()
                                    const buffer = Buffer.from(arrayBuffer)
                                    fs.writeFileSync(sfPath, buffer)
                                    logger.mark(`${this.e.logFnc} 下载本地策略图片成功：${author.source}-${name}`)
                                    return true
                                } else {
                                    logger.warn(`${this.e.logFnc} 下载本地策略图片失败，HTTP状态：${response.status}`)
                                }
                            } catch (downloadErr) {
                                logger.warn(`${this.e.logFnc} 下载本地策略图片异常：${downloadErr.message}`)
                            }

                            // 下载失败，返回原始 link 让上层继续尝试（上层会自行拼接 oss）
                            return entry.link
                        }
                    }
                }
                return null
            } catch (err) {
                logger.warn(`本地策略查找出错：${err}`)
                return null
            }
        }

        // 先试本地
        try {
            const localResult = await tryLocalStrategy()
            if (localResult === true) {
                // 下载成功
                return true
            } else if (typeof localResult === 'string') {
                // 返回了 url 但下载失败，尝试用 commonTools 下载
                logger.mark(`${this.e.logFnc} 尝试用 commonTools 下载：${localResult}`)
                if (!await commonTools.download(localResult + this.oss, sfPath)) {
                    logger.warn(`${this.e.logFnc} 本地链接下载失败，回退到米游社抓取：${localResult}`)
                    // 继续走米游社逻辑 below
                } else {
                    logger.mark(`${this.e.logFnc} 下载本地策略图片成功：${author?.source || '未知作者'}-${name}`)
                    return true
                }
            }
            // localResult 为 null，继续走米游社逻辑
        } catch (err) {
            logger.warn(`尝试本地策略下载时发生异常：${err}`)
            // 继续到米游社抓取
        }

        // fallback to existing 米游社抓取逻辑
        let msyRes = []
        // collection_id 必须存在并且作者对象保持一致
        if (!author || !author.collection_id) {
            logger.warn(`作者 ${author?.source} 未提供 collection_id，且本地策略未命中，无法从米游社抓取`)
            return false
        }

        for (const i of author.collection_id) {
            msyRes.push(await commonTools.getFetchData(this.url + i))
        }

        try {
            msyRes = await Promise.all(msyRes)
        } catch (error) {
            logger.error(`米游社接口报错：${error}}`)
            return false
        }

        let posts = _.flatten(_.map(msyRes, item => item.data.posts))
        let url
        let _post = []
        for (let val of posts) {
            /** 攻略图个别来源特殊处理 */
            if (author.collection_id.includes(341523)) {
                if (val.post.structured_content.includes(name + '】')) {
                    let content = val.post.structured_content.replace(/\\\/\{\}/g, '')
                    // 常驻角色特殊处理
                    let pattern = new RegExp(name + '】.*?image\\\\?":\\\\?"(.*?)\\\\?"')
                    let imgId = pattern.exec(content)[1]
                    url = _.find(val.image_list, v => v.image_id === imgId).url
                    break
                }
            } else {
                if (val.post.subject.includes(name)) {
                    url = this.getMax(val.image_list)
                    break
                } else if (filter) {
                    filter = new RegExp(filter)
                    if (filter.test(val.post.subject)) {
                        url = this.getMax(val.image_list)
                        break
                    }
                } else if (_.map(val.topics, 'name').includes(name)) {
                    _post.push(this.getMax(val.image_list))
                }
            }
        }

        if (!url) {
            if (_.isEmpty(_post)) {
                logger.mark(`暂无${name}攻略（${author.source}）`)
                return false
            } else url = _post[0]
        }

        logger.mark(`${this.e.logFnc} 下载${author.source}-${name}攻略图`)

        if (!await commonTools.download(url + this.oss, sfPath)) return false

        logger.mark(`${this.e.logFnc} 下载${author.source}-${name}攻略成功`)

        return true
    }

    getMax(imgs) {
        return _.maxBy(imgs, v => Number(v.size)).url
    }

    async checkPath(path) {
        if (!fs.existsSync(path)) {
            await this.e.reply(moracfg.resNotFound, true)
            return false
        }
    }

    /**
     * 查找存在的路径（支持多个候选路径）
     * @param {string[]} paths 候选路径数组
     * @returns {string|null} 第一个存在的路径或 null
     */
    findExistingPath(paths) {
        for (const p of paths) {
            if (fs.existsSync(p)) return p
        }
        return null
    }
}