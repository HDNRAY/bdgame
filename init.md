Roguelite游戏，代号《单挑》

I need a full plan （tech stack, code base structure, game engine analyze and choice, git repo init) for demo/mvp to start developing a roguelite auto-battle Chinese kongfu word game. Let’s have plan doc first and write and update the doc step by step, don’t try to create the whole doc at one shot, you have a limit of 500 lines of a file.

1. The game is like 30? nodes, player pick 1 of 3 random type node. Some of them are fixed as boss/final boss battle. We will discuss node types in latter chapter
2. Background story, it is like in 2088, 赛博化，贫富差距大，有义体？需要能源，但是不能使用枪械等热武器，人类也发掘了自身的 炁？。 第n届xx镇武斗大会，32强守门人战 =》 小组赛（3场） =》 8强 =》 4强 =》 半决赛 =》 决赛
3. Core systems:
    1. skill(named like 功法） , could be learn in some node or develop self in some node, or learn from enemy, has special function, normally passive
    2. actions (including 正拳，回旋踢，and other 招术), could be learn in some node or develop self in some node, or learn from enemy
    3. triggers， trigger by some condition like hp lower than \*%, incoming action, enemy plan to give you poison, get 流血 and so on, but trigger slot is required to activate triggers, trigger slot could be earn by special event(node) or high 悟性
    4. 义体, earn in event(node) as 义体化 increase, extremely increase 力道, 根骨，身法，灵巧 , punish will increase, firstly 失衡（reduce 身法）, 缺能(need more energy/battery, debuff after a given battle time), 失心(lost mind， reduce 悟性)
    5. 首饰，蕴含奇异力量，有特殊增幅的物品，不过需要进一步晚上背景上的解释，或者就不要
    6. 炼炁，required very high initial 悟性, could increase self body(all other attributes) or 御物 (remote/range weapon, high 命中，暴击）
4. Attributes: 力道str，根骨vit，身法dex，灵巧tec，洞察，悟性。each attribute will impact multiple things, and enough high attribute could bring special skills(probably passive). Each attributes should be able to impact on both in-battle and out-battle Some thinkings:
    1. 力道: impact damages ; if use cold weapons，could improve parry chance and increase damage reduction of parry; reduce punish(in balance 失衡) from 义体 or heavy cold weapon like claymore
    2. 根骨: impact hp; reduce punish(in balance 失衡) from 义体 or heavy cold weapon like claymore; reduce impact of 流血, 中毒; special skill: 铁布衫, reduce damage in percentage
    3. 身法: impact dodge, move speed, action interval (yes we have distance, role using different weapon should keep distance, 拳头，刀剑，长枪大刀，暗器御物, all has different distance)， high 身法 & 悟性 could learn 凌波微步
    4. 灵巧: impact 命中，暴击。damage of 暗器，匕首 ， high 灵巧 & low 悟性，could learn 左右互博
    5. 洞察: impact 命中，dodge， 暴击，high 洞察 & 悟性，could learn（steal） skills from enemy
    6. 悟性: impact count trigger slots，
5. UI: I prefer a very old working style but providing full interacting feeling system, support “keyboard only(full shortcuts)”, “mouse” and 触屏(mobile), all buttons has a very simple styling but has pressing state, focus state(curser pointer with arrow key); tooltips on all items/skills/attrs almost every name, hover on pc but tap on mobile, maybe a particular area on screen for keyboard mode
6. Tech stack: I want it to be able to play in web and application, and the ui is simple, emmm we may update to have pixels, I want a modern solution, I don’t like pure game engine like unity cocos ue
7. Battle system, an event based queue, battle has state like battle start/in battle/battle end. Each turn also has state. Turn start/action/turn end. Each character has turns by 身法 and other factors. Poison dot has independent event turn. But 流血 dot, trigger on action and being attacked, dodge also will lost blood. Some passive summer also has independent turn, like auto defense 御物, has its turn to recover once get destroyed/inactived. Some aciton has 前摇 and 硬直 time
8. Event/node, should be a small story/challenge to obtain any thing , I need a brainstorm for this part, me first, attributes increment, special event for special skill/action, 改造义体, the type/direction of event/node should based on charactor’s current build
9. Skills and actions, I also need a brainstorm, but we can extends this part after mvp, for mvp, let’s just have couple build’s skills and passive. Each build I hope it is very hard to collect all in the game, and most skills and actions should be “shared” in different build, like “针” could be weapon of 暗器 or 御物, or 炼炁 could be enhance body or 御物, most 功法 should have more than 1 factor attribute.
10. One of features of this game is triggers, I also need a brainstorm
