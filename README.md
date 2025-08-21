# 睿涵音乐教学后台（Django）

一个面向教学团队的后台管理系统，前端为 Django 模板 + 原生 JS/CSS，后端为 Django 应用，数据暂使用 SQLite（开发环境）。

主要代码位置：
- 后端应用：apps/teaching、apps/research（以及 accounts、students 等依赖）
- 前端模板与静态资源：templates/teaching/feedback.html、static/js/teaching.js、static/css/teaching.css
- 配置：config/settings.py、config/urls.py
- 种子数据：scripts/seed_teaching_test_data.py

## 技术栈与关键依赖

- 后端框架：Django（manage.py 入口，settings 模块为 config.settings）
- 数据库：SQLite（开发环境，强烈建议不提交到仓库）
- 前端：Django 模板 + 原生 JavaScript + CSS（不依赖前端框架）
- 静态资源组织：static/js、static/css
- 模板：templates 下分模块组织

建议 Python 3.x；依赖详见项目根目录 requirements.txt。


进入项目目录
```bash
cd "/Users/xiny_li/睿涵音乐后台/vibe coding"
```

创建虚拟环境
```bash
python3 -m venv .venv
```

激活虚拟环境
```bash
source .venv/bin/activate
```

安装依赖
```bash
pip install -r requirements.txt
```

数据库迁移
```bash
python manage.py migrate
```

创建超级用户（交互式）
```bash
python manage.py createsuperuser
```

启动开发服务
```bash
python manage.py runserver
```

访问浏览器输出的本地地址（通常 http://127.0.0.1:8000/）， 登录后台或直接进入教学模块（学员点评页）进行验证。

### 可选：写入示例数据（通过 Django shell）

进入 shell
```bash
python manage.py shell
```

在交互式 shell 中执行（脚本默认 TEACHER_USERNAME/RESEARCHER_USERNAME 为 'admin'）：
```bash
from scripts.seed_teaching_test_data import run; run()
```

完成后刷新教学页面即可看到“今日任务”数据。





