import plugin from '../../../lib/plugins/plugin.js'
import commonTools from '../model/commonTools.js'
import moracfg from '../model/config.js'
import _ from 'lodash'
import fs from 'node:fs'
import fetch from 'node-fetch'
import path from 'path'
import { exec } from 'child_process'
/**
 * 借鉴原云崽攻略代码
 * 攻略来自NGA@妮可少女
 */
/**
 * 深渊/混沌/虚构/末日/幽境危战/剧诗/异相仲裁版本图片发送，支持别名
 * 数据来自NGA@妮可少女 
 * 玖、grok、GitHub copilot
 */

export class abyssVersion extends plugin {
  constructor() {
    // 构建别名和正则列表只维护一份，自动生成
    const aliasDict = abyssVersion.getAliasesStatic();
    const aliasList = Array.from(new Set(
      Object.values(aliasDict).flatMap(obj => Object.entries(obj).flatMap(([key, arr]) => [key, ...arr]))
    ));
    const typeReg = aliasList.map(_.escapeRegExp).join("|");
    super({
      name: '摩拉深渊版本',
      dsc: '各版本深渊怪物',
      event: 'message',
      priority: 5,
      rule: [
        {
          reg: `^#?(原神|星铁)?([1-9]\\.\\d{1})(${typeReg})$`,
          fnc: 'abyssVersion'
        },
        {
          reg: '^#?历代12(层|-[1-3])?(最低输出量)?$',
          fnc: 'history12'
        },
        {
          reg: '^#?[1-9]\.\\d(深渊)?阵容(参考|推荐)?$',
          fnc: 'teamRefer'
        }
      ]
    })

        // Abyss 目录
        this.abyssDir = path.join(process.cwd(), 'data', 'Abyss')
        if (!fs.existsSync(this.abyssDir)) {
            fs.mkdirSync(this.abyssDir, { recursive: true })
        }
        // 设置cron任务，每15天删除一次data/Abyss目录
        const cronExpression = '0 0 */15 * *';
        const job = new CronJob(cronExpression, () => {
            if (fs.existsSync(this.abyssDir)) {
                fs.rmSync(this.abyssDir, { recursive: true, force: true });
                console.log('Deleted data/Abyss directory.');
                // 重新创建目录
                fs.mkdirSync(this.abyssDir, { recursive: true });
            }
        }, null, true);
  }

  // 静态别名数据（正则和功能共用）
  static getAliasesStatic() {
    return {
      ys: {
        "深境螺旋": ["深渊", "深境", "螺旋"],
        "幽境危战": ["幽境", "危战"],
        "幻想真境剧诗": ["幻想", "真境", "剧诗"]
      },
      sr: {
        "混沌回忆": ["混沌", "回忆", "深渊"],
        "虚构叙事": ["虚构", "叙事"],
        "末日幻影": ["末日", "幻影"],
        "异相仲裁": ["异相", "仲裁"]
      }
    }
  }

  // 实例别名，兼容旧逻辑（也可直接用静态的）
  getAliases() {
    return abyssVersion.getAliasesStatic();
  }

  // 下载单个图片
  async downloadImage(imgV) {
    const url = `https://homdgcat.wiki/Abyss/CH/${imgV}.png`
    const local = path.join(this.abyssDir, `${imgV}.png`)
    try {
      const res = await fetch(url)
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer()
        fs.writeFileSync(local, Buffer.from(arrayBuffer))
        return true
      }
    } catch (e) { }
    return false
  }

  // 优先本地图片，没有则自动下载再发本地图片
  async getImageSegment(imgV) {
    const local = path.join(this.abyssDir, `${imgV}.png`)
    if (fs.existsSync(local)) {
      // 优先本地图片
      return segment.image(local)
    } else {
      // 没有则自动下载图片
      const downloaded = await this.downloadImage(imgV)
      if (downloaded && fs.existsSync(local)) {
        return segment.image(local)
      } else {
        // fallback 到远程链接（理论上下载失败才走这里）
        return segment.image(`https://homdgcat.wiki/Abyss/CH/${imgV}.png`)
      }
    }
  }

  // 获取 Gitee 剧诗图片
  async getJuShiImageSegments(version) {
    let baseUrl = "https://gitee.com/mingdiandianzhu/miaoresources/raw/master/abyss/"
    let segList = [`+${version}`, `+${version}A`, `+${version}B`]
    let imageSegments = []
    for (let segVer of segList) {
      let imgUrl = `${baseUrl}${segVer}.jpg`
      try {
        let res = await fetch(imgUrl, { method: 'HEAD' })
        if (res.ok) {
          imageSegments.push(segment.image(imgUrl))
        }
      } catch (e) { }
    }
    return imageSegments
  }

  // 获取标准名称（支持别名）
  getFormalName(role, game) {
    const aliases = this.getAliases()[game] || {}
    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(role) || key === role) {
        return key
      }
    }
    return role // 未找到别名返回原名
  }

  // 判断是否为某挑战类型（支持别名）
  matchType(type, game, target) {
    const formalName = this.getFormalName(type, game)
    return formalName === target
  }

  async abyssVersion() {
    await this.e.reply('查询中，请稍后', true, { recallMsg: 20 })

    // 动态获取aliasList和typeReg
    const aliasList = Array.from(new Set(
      Object.values(this.getAliases()).flatMap(obj => Object.entries(obj).flatMap(([key, arr]) => [key, ...arr]))
    ));
    const typeReg = aliasList.map(_.escapeRegExp).join("|");

    let match = new RegExp(`^#?(原神|星铁)?([1-9]\\.\\d{1})(${typeReg})$`).exec(this.e.msg)
    if (!match) return false

    let [, gameType, version, abyss] = match
    let game = gameType === '星铁' ? 'sr' : 'ys'

    // 转换为标准名称
    let formalAbyss = this.getFormalName(abyss, game)
    if (['混沌回忆', '虚构叙事', '末日幻影', '异相仲裁'].includes(formalAbyss)) game = 'sr'

    let imgVersion = version

    // 处理幽境危战：版本号前加-
    if (this.matchType(formalAbyss, game, '幽境危战')) {
      imgVersion = '-' + version
    } else if (this.matchType(formalAbyss, game, '幻想真境剧诗')) {
      let juShiImages = await this.getJuShiImageSegments(version)
      if (juShiImages.length > 0) {
        let msg = [
          `原神 ${version} ${formalAbyss}\n来源：妮可少女`
        ]
        juShiImages.forEach(seg => msg.push(seg))
        await this.e.reply(msg)
        return true
      } else {
        await this.e.reply(`暂无原神 ${version} 版本 ${formalAbyss} 图片`)
        return false
      }
    } else if (game === 'sr') {
      // 星铁挑战类型图片编号，3.6/3.7写死，后续自动推算
      const srAbyssMap = {
        '混沌回忆': { '3.6': '1027', '3.7': '1028' },
        '虚构叙事': { '3.6': '2018', '3.7': '2019' },
        '末日幻影': { '3.6': '3012', '3.7': '3013' },
        '异相仲裁': { '3.6': '4001', '3.7': '4002' }
      }
      if (srAbyssMap[formalAbyss] && srAbyssMap[formalAbyss][version]) {
        imgVersion = srAbyssMap[formalAbyss][version]
      } else if (['混沌回忆', '虚构叙事', '末日幻影', '异相仲裁'].includes(formalAbyss)) {
        const baseValues = {
          '混沌回忆': 1027,
          '虚构叙事': 2018,
          '末日幻影': 3012,
          '异相仲裁': 4001
        }
        const baseValue = baseValues[formalAbyss] || 0
        if (baseValue && version.match(/^(\d+)\.(\d)$/)) {
          let [vMain, vSub] = version.split('.').map(Number)
          let offset = (vMain - 3) * 10 + (vSub - 6)
          imgVersion = String(baseValue + offset)
        }
      }
    }

    // 直接使用3个图片（优先本地，没有则自动下载再发本地）
    let imageSegments = []
    if (game === 'ys' && this.matchType(formalAbyss, game, '深境螺旋')) {
      let segList = [`${imgVersion}`, `${imgVersion}A`, `${imgVersion}B`]
      for (let segVer of segList) {
        let seg = await this.getImageSegment(segVer)
        if (seg) imageSegments.push(seg)
      }
    } else {
      let mainSeg = await this.getImageSegment(imgVersion)
      if (mainSeg) imageSegments.push(mainSeg)
    }

    if (imageSegments.length > 0) {
      let msg = [
        `${game === 'sr' ? '星铁' : '原神'} ${version} ${formalAbyss}\n来源：妮可少女`
      ]
      imageSegments.forEach(seg => msg.push(seg))
      await this.e.reply(msg)
      return true
    } else {
      await this.e.reply(`暂无${game === 'sr' ? '星铁' : '原神'} ${version}版本的${formalAbyss}图片`)
      return false
    }
  }

  /** 12层历史 */
  async history12() {
    this.path = `${this.dirPath(this.e.game)}/Version/history12`
    await this.checkRes(this.path)

    let room = /^#?历代12(层|-[1-3])?(最低输出量)?$/.exec(this.e.msg)[1]
    if (!room) return false

    let msg = []

    if (room === '层') {
      let pics = fs.readdirSync(this.path)
      _.each(pics, (v) => msg.push(segment.image(`file://${this.path}/${v}`)))
      await this.e.reply(await commonTools.makeMsg(this.e, msg, '历代深渊12层最低输出量'))
    } else {
      let img = `${this.path}/历代12${room}最低输出量.png`
      if (fs.existsSync(img)) await this.e.reply(segment.image(`file://${img}`))
    }
    return true
  }

  async teamRefer() {
    this.path = `${this.dirPath(this.e.game)}/Teams/`
    await this.checkRes(this.path)

    let ver = /^#?([1-9]\.\d)深渊?阵容(参考|推荐)?$/.exec(this.e.msg)[1]
    if (!ver) return false

    let img = `${this.path}卡玛sei亚/${ver}.png`
    if (!fs.existsSync(img)) {
      await this.e.reply(`暂无${ver}深渊阵容`)
      return false
    }
    await this.e.reply(segment.image(`file://${img}`))
    return true
  }
  // 检查图片链接是否可访问
  async checkImage(url) {
    try {
      const res = await fetch(url);
      return res.ok;
    } catch (e) {
      logger.error(`[abyssVersion] 图片检查失败: ${url}, 错误: ${e.message}`);
      return false;
    }
  }
  async checkRes(path) {
    if (!fs.existsSync(path)) {
      await this.e.reply(moracfg.resNotFound, true)
      return false
    }
  }
}
