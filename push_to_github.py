# -*- coding: utf-8 -*-
import os
import sys
import subprocess

def run_cmd(cmd, desc=""):
    print(f"🔄 {desc}...")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        if "nothing to commit" in res.stdout or "nothing to commit" in res.stderr:
            return True, ""
        return False, res.stderr or res.stdout
    return True, res.stdout

def main():
    print("=" * 60)
    print("🕋  أداة رفع مشروع «رِفقة» إلى GitHub تلقائياً")
    print("=" * 60)
    print()

    # 1. Check Git
    ok, out = run_cmd("git --version", "التحقق من تثبيت Git")
    if not ok:
        print("❌ لم يتم العثور على Git مثبت في جهازك!")
        input("اضغط Enter للخروج...")
        return

    print("✅ Git مثبت وجاهز للعمل.")
    print()

    # 2. Get repository URL
    repo_url = input("🔗 الصق رابط مستودع GitHub هنا:\n(مثال: https://github.com/YourUsername/rifqa-whatsapp.git): \n> ").strip()

    if not repo_url:
        print("❌ لم يتم إدخال رابط المستودع!")
        input("اضغط Enter للمحاولة لاحقاً...")
        return

    print()
    # 3. Git Init
    if not os.path.exists(".git"):
        run_cmd("git init", "تهيئة مستودع Git محلي")

    # 4. Set branch main
    run_cmd("git branch -M main", "ضبط الفرع الرئيسي على main")

    # 5. Add all files
    run_cmd("git add .", "إضافة ملفات المشروع وتجهيزها")

    # 6. Commit
    ok, out = run_cmd('git commit -m "Initial commit: Rifqa WhatsApp CRM & Engine"', "تسجيل الـ Commit")
    
    # 7. Add or update remote
    subprocess.run("git remote remove origin", shell=True, capture_output=True)
    ok, out = run_cmd(f'git remote add origin "{repo_url}"', "ربط المشروع برابط GitHub")

    # 8. Push to GitHub
    print("🚀 جاري رفع المشروع إلى GitHub الآن...")
    push_res = subprocess.run("git push -u origin main", shell=True)
    
    print()
    if push_res.returncode == 0:
        print("=" * 60)
        print("🎉 مبارك! تم رفع المشروع بنجاح 100% إلى GitHub!")
        print("=" * 60)
        print("📌 الخطوة التالية لـ Render:")
        print("1. افتح Render.com واضغط New ➔ Web Service.")
        print(f"2. اربط حساب GitHub واختر مستودع المشروع.")
        print("3. الإعدادات:")
        print("   • Build Command: npm install")
        print("   • Start Command: node server.js")
        print("4. اضغط Deploy وسيشتغل البوت 24/7 في السحابة!")
        print("=" * 60)
    else:
        print("⚠️ حدث تنبيه أثناء الرفع. تأكد من صحة الرابط وأنك مسجل الدخول في GitHub.")

    print()
    input("اضغط Enter للإغلاق...")

if __name__ == "__main__":
    main()
