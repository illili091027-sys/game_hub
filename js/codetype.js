/* ⌨️ 코드 타자 연습 (혼자 하기)
   언어(Java · Python · C)를 고르고, 왼쪽 목록에서 연습을 골라 코드를 그대로 쳐요.
   - 복사·붙여넣기·자동완성 불가, 한 글자씩 직접 쳐야 해요.
   - 코드 에디터처럼 줄 번호와 색이 보이고, 친 글자는 진하게 / 틀린 글자는 빨갛게 표시돼요.
   - 타수(1분에 맞게 친 글자 수), 정확도, 시간을 재고 연습별 최고 기록을 저장해요. */

var CT_DATA = {
  java: { name: 'Java', file: 'Main.java', color: '#F2836B', icon: '☕', items: [
    ['Hello World 출력하기', String.raw`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}`],
    ['변수 선언하기', String.raw`int age = 20;
double pi = 3.14;
String name = "Kim";
boolean ok = true;`],
    ['if 조건문 만들기', String.raw`int score = 85;
if (score >= 90) {
    System.out.println("A");
} else {
    System.out.println("B");
}`],
    ['for 반복문 실행시키기', String.raw`for (int i = 0; i < 5; i++) {
    System.out.println(i);
}`],
    ['메서드 만들기', String.raw`public static int add(int a, int b) {
    return a + b;
}`],
    ['배열 순회하기', String.raw`int[] nums = {1, 2, 3};
for (int n : nums) {
    System.out.println(n);
}`],
    ['입력받기 (Scanner)', String.raw`import java.util.Scanner;

Scanner sc = new Scanner(System.in);
int n = sc.nextInt();
System.out.println(n * 2);`],
    ['클래스와 객체 만들기', String.raw`class Dog {
    String name;
    Dog(String name) {
        this.name = name;
    }
}
Dog d = new Dog("Rex");`]
  ] },
  python: { name: 'Python', file: 'main.py', color: '#F2C744', icon: '🐍', items: [
    ['Hello World 출력하기', String.raw`print("Hello, Python!")`],
    ['변수 선언하기', String.raw`age = 20
pi = 3.14
name = "Kim"
ok = True`],
    ['if 조건문 만들기', String.raw`score = 85
if score >= 90:
    print("A")
else:
    print("B")`],
    ['for 반복문 실행시키기', String.raw`for i in range(5):
    print(i)`],
    ['함수 만들기', String.raw`def add(a, b):
    return a + b

print(add(1, 2))`],
    ['리스트 다루기', String.raw`nums = [1, 2, 3]
nums.append(4)
for n in nums:
    print(n)`],
    ['딕셔너리 다루기', String.raw`ages = {"kim": 20, "lee": 21}
ages["park"] = 22
for k, v in ages.items():
    print(k, v)`],
    ['클래스와 객체 만들기', String.raw`class Dog:
    def __init__(self, name):
        self.name = name

d = Dog("Rex")`]
  ] },
  c: { name: 'C', file: 'main.c', color: '#7BB8F2', icon: '🔧', items: [
    ['Hello World 출력하기', String.raw`#include <stdio.h>

int main(void) {
    printf("Hello, C!\n");
    return 0;
}`],
    ['변수 선언하기', String.raw`int age = 20;
double pi = 3.14;
char grade = 'A';
float h = 175.5f;`],
    ['if 조건문 만들기', String.raw`int score = 85;
if (score >= 90) {
    printf("A\n");
} else {
    printf("B\n");
}`],
    ['for 반복문 실행시키기', String.raw`for (int i = 0; i < 5; i++) {
    printf("%d\n", i);
}`],
    ['함수 만들기', String.raw`int add(int a, int b) {
    return a + b;
}`],
    ['배열 순회하기', String.raw`int nums[3] = {1, 2, 3};
for (int i = 0; i < 3; i++) {
    printf("%d\n", nums[i]);
}`],
    ['포인터 기초', String.raw`int x = 10;
int *p = &x;
*p = 20;
printf("%d\n", x);`],
    ['구조체 만들기', String.raw`struct Dog {
    char name[20];
    int age;
};
struct Dog d = {"Rex", 3};`]
  ] }
};


/* 긴 코드: 실제 프로그램처럼 조금 더 긴 연습 (목록에서 "긴 코드" 아래에 나와요) */
CT_DATA.java.items.push(
  ['구구단 출력하기', String.raw`public class Main {
    public static void main(String[] args) {
        for (int i = 2; i <= 9; i++) {
            for (int j = 1; j <= 9; j++) {
                System.out.println(i + " x " + j + " = " + (i * j));
            }
        }
    }
}`, 'long'],
  ['평균 구하기', String.raw`public class Main {
    public static void main(String[] args) {
        int[] scores = {90, 85, 77, 100, 68};
        int sum = 0;
        for (int s : scores) {
            sum += s;
        }
        double avg = (double) sum / scores.length;
        System.out.println("Average: " + avg);
    }
}`, 'long'],
  ['계좌 클래스 만들기', String.raw`public class Account {
    private int balance;

    public Account(int balance) {
        this.balance = balance;
    }

    public void deposit(int amount) {
        balance += amount;
    }

    public boolean withdraw(int amount) {
        if (amount > balance) {
            return false;
        }
        balance -= amount;
        return true;
    }

    public int getBalance() {
        return balance;
    }
}`, 'long']
);
CT_DATA.python.items.push(
  ['구구단 출력하기', String.raw`for i in range(2, 10):
    for j in range(1, 10):
        print(f"{i} x {j} = {i * j}")`, 'long'],
  ['피보나치 함수 만들기', String.raw`def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

for i in range(10):
    print(fib(i))`, 'long'],
  ['성적 관리 클래스 만들기', String.raw`class Student:
    def __init__(self, name, scores):
        self.name = name
        self.scores = scores

    def average(self):
        return sum(self.scores) / len(self.scores)

    def grade(self):
        avg = self.average()
        if avg >= 90:
            return "A"
        elif avg >= 80:
            return "B"
        return "C"

s = Student("Kim", [90, 85, 77])
print(s.name, s.average(), s.grade())`, 'long']
);
CT_DATA.c.items.push(
  ['구구단 출력하기', String.raw`#include <stdio.h>

int main(void) {
    for (int i = 2; i <= 9; i++) {
        for (int j = 1; j <= 9; j++) {
            printf("%d x %d = %d\n", i, j, i * j);
        }
    }
    return 0;
}`, 'long'],
  ['배열에서 최댓값 찾기', String.raw`#include <stdio.h>

int main(void) {
    int nums[5] = {3, 9, 4, 7, 1};
    int max = nums[0];
    for (int i = 1; i < 5; i++) {
        if (nums[i] > max) {
            max = nums[i];
        }
    }
    printf("max = %d\n", max);
    return 0;
}`, 'long'],
  ['구조체 배열 다루기', String.raw`#include <stdio.h>

struct Student {
    char name[20];
    int score;
};

int main(void) {
    struct Student list[2] = {{"Kim", 90}, {"Lee", 85}};
    int sum = 0;
    for (int i = 0; i < 2; i++) {
        sum += list[i].score;
    }
    printf("avg = %.1f\n", sum / 2.0);
    return 0;
}`, 'long']
);

var CT_KW = {
  java: 'public|private|class|static|void|int|double|float|char|String|boolean|if|else|for|while|return|new|this|import|final|true|false|null',
  python: 'def|class|if|elif|else|for|while|return|in|import|from|print|True|False|None|and|or|not|range|self',
  c: 'int|double|float|char|void|if|else|for|while|return|struct|const|unsigned|sizeof|printf|scanf|NULL'
};

var CT = { lang: null, idx: 0, target: '', colors: [], t0: 0, total: 0, wrong: 0, prev: 0, done: false, skip: true, timer: null };

function ctEsc(c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c; }

/* 글자마다 색 종류를 정해요 (키워드·문자열·숫자·주석) */
function ctColors(lang, code) {
  var cls = [], i;
  for (i = 0; i < code.length; i++) cls.push('d');
  function mark(re, c) {
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      for (var k = m.index; k < m.index + m[0].length; k++) cls[k] = c;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  mark(new RegExp('\\b(' + CT_KW[lang] + ')\\b', 'g'), 'kw');
  mark(/\b\d+(\.\d+)?f?\b/g, 'num');
  if (lang === 'c') mark(/^#.*$/gm, 'kw');
  mark(/"(\\.|[^"\\\n])*"|'(\\.|[^'\\\n])*'/g, 'str');
  mark(lang === 'python' ? /#.*$/gm : /\/\/.*$/gm, 'com');
  return cls;
}

/* ---------- 기록 ---------- */
function ctKey(l, i) { return 'gamehub_codetype_best_' + l + '_' + i; }
function ctBest(l, i) { try { return JSON.parse(localStorage.getItem(ctKey(l, i)) || 'null'); } catch (e) { return null; } }
function ctSaveBest(l, i, rec) { try { localStorage.setItem(ctKey(l, i), JSON.stringify(rec)); } catch (e) {} }

/* ---------- 화면 ---------- */
function startCodeTypeGame() { stopCodeTypeGame(); ctShowLang(); }
function stopCodeTypeGame() { clearInterval(CT.timer); CT.timer = null; }

function ctShowLang() {
  stopCodeTypeGame();
  CT.lang = null;
  var html = '<div class="ct-langs"><p class="ct-lead">연습할 언어를 골라요. 코드를 직접 치면서 문법을 몸에 익혀요.</p><div class="ct-lang-row">';
  ['java', 'python', 'c'].forEach(function (id) {
    var D = CT_DATA[id], done = 0;
    D.items.forEach(function (_, i) { if (ctBest(id, i)) done++; });
    html += '<button class="ct-lang" style="--lc:' + D.color + '" onclick="ctPickLang(\'' + id + '\')">' +
      '<span class="ct-lang-ic">' + D.icon + '</span><b>' + D.name + '</b>' +
      '<small>연습 ' + D.items.length + '개 (기본+긴 코드) · 완료 ' + done + '개</small></button>';
  });
  html += '</div></div>';
  document.getElementById('ct-root').innerHTML = html;
}

function ctPickLang(id) {
  CT.lang = id;
  var D = CT_DATA[id];
  document.getElementById('ct-root').innerHTML =
    '<div class="ct-play" style="--lc:' + D.color + '">' +
      '<aside class="ct-side">' +
        '<button class="ct-back" onclick="ctShowLang()">← 언어 다시 고르기</button>' +
        '<div class="ct-side-title">' + D.icon + ' ' + D.name + '</div>' +
        '<div id="ct-list" class="ct-list"></div>' +
      '</aside>' +
      '<section class="ct-main">' +
        '<div class="ct-lesson" id="ct-lesson"></div>' +
        '<div class="ct-stats">' +
          '<span>⌨️ <b id="ct-cpm">0</b>타</span><span>🎯 <b id="ct-acc">100</b>%</span>' +
          '<span>⏱ <b id="ct-time">0.0</b>초</span><span>📈 <b id="ct-prog">0</b>%</span>' +
        '</div>' +
        '<div class="ct-bar"><div class="ct-bar-in" id="ct-bar"></div></div>' +
        '<div class="ct-editor">' +
          '<div class="ct-editor-top"><i></i><i></i><i></i><span>' + D.file + '</span></div>' +
          '<div class="ct-codewrap" id="ct-wrap"><div id="ct-code" class="ct-code"></div>' +
            '<textarea id="ct-inp" class="ct-inp" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="타자 입력"></textarea></div>' +
        '</div>' +
        '<div class="ct-notice" id="ct-notice"></div>' +
        '<div class="ct-done" id="ct-done"></div>' +
        '<div class="ct-btns">' +
          '<button class="btn btn-ghost" onclick="ctReset()">↻ 처음부터</button>' +
          '<button class="btn btn-ghost" id="ct-skipbtn" onclick="ctToggleSkip()"></button>' +
        '</div>' +
        '<p class="ct-help">영문 입력 상태에서 쳐요. 복사·붙여넣기와 자동완성은 막혀 있어요.</p>' +
      '</section>' +
    '</div>';
  ctBuildList();
  ctBindInput();
  clearInterval(CT.timer);
  CT.timer = setInterval(function () { if (CT.t0 && !CT.done) ctStats(); }, 300);
  ctSelect(0);
}

function ctBuildList() {
  var D = CT_DATA[CT.lang], html = '', prevLong = null;
  D.items.forEach(function (it, i) {
    var isLong = it[2] === 'long';
    if (prevLong !== isLong) { html += '<div class="ct-grp">' + (isLong ? '📜 긴 코드' : '🌱 기본 문법') + '</div>'; prevLong = isLong; }
    var b = ctBest(CT.lang, i);
    html += '<button class="ct-item' + (i === CT.idx ? ' on' : '') + '" onclick="ctSelect(' + i + ')">' +
      '<span class="ct-item-name">' + it[0] + '</span>' +
      '<span class="ct-item-best">' + (b ? '👑 ' + b.cpm + '타' : '') + '</span></button>';
  });
  document.getElementById('ct-list').innerHTML = html;
}

function ctSelect(i) {
  CT.idx = i;
  var it = CT_DATA[CT.lang].items[i];
  CT.target = it[1];
  CT.colors = ctColors(CT.lang, it[1]);
  document.getElementById('ct-lesson').textContent = it[0];
  ctBuildList();
  ctReset();
}

function ctToggleSkip() { CT.skip = !CT.skip; ctSkipLabel(); var f = document.getElementById('ct-inp'); if (f) f.focus(); }
function ctSkipLabel() {
  var b = document.getElementById('ct-skipbtn');
  if (b) b.textContent = CT.skip ? '↹ 들여쓰기 자동 건너뛰기: 켜짐' : '↹ 들여쓰기 자동 건너뛰기: 꺼짐 (Tab = 공백 4칸)';
}

function ctReset() {
  var inp = document.getElementById('ct-inp');
  if (!inp) return;
  inp.value = '';
  CT.t0 = 0; CT.total = 0; CT.wrong = 0; CT.prev = 0; CT.done = false;
  document.getElementById('ct-done').innerHTML = '';
  document.getElementById('ct-done').classList.remove('on');
  document.getElementById('ct-notice').textContent = '';
  ctSkipLabel();
  ctRender();
  ctStats();
  inp.focus();
}

/* ---------- 그리기 ---------- */
function ctRender() {
  var v = document.getElementById('ct-inp').value, t = CT.target, html = '', i = 0;
  var lines = t.split('\n');
  for (var n = 0; n < lines.length; n++) {
    html += '<div class="ct-ln"><span class="ct-no">' + (n + 1) + '</span><span class="ct-tx">';
    var line = lines[n];
    for (var k = 0; k <= line.length; k++, i++) {
      var isNl = (k === line.length);
      if (isNl && n === lines.length - 1) break;
      var c = isNl ? '\n' : line[k];
      var st = '';
      if (i < v.length) st = v[i] === c ? 'ok' : 'bad';
      else if (i === v.length && !CT.done) st = 'cur';
      var cl = 'ct-c ' + CT.colors[i] + (st ? ' ' + st : '');
      if (isNl) html += '<span class="' + cl + ' nl">↵</span>';
      else if (c === ' ' && st === 'bad') html += '<span class="' + cl + '">·</span>';
      else html += '<span class="' + cl + '">' + ctEsc(c) + '</span>';
    }
    html += '</span></div>';
  }
  document.getElementById('ct-code').innerHTML = html;
}

function ctStats() {
  var inp = document.getElementById('ct-inp');
  if (!inp) return;
  var v = inp.value, ok = 0;
  for (var i = 0; i < v.length; i++) if (v[i] === CT.target[i]) ok++;
  var sec = CT.t0 ? (Date.now() - CT.t0) / 1000 : 0;
  var good = Math.max(0, CT.total - CT.wrong);
  document.getElementById('ct-cpm').textContent = sec > 0.5 ? Math.round(good / (sec / 60)) : 0;
  document.getElementById('ct-acc').textContent = CT.total ? Math.round(good / CT.total * 100) : 100;
  document.getElementById('ct-time').textContent = sec.toFixed(1);
  var p = Math.round(ok / CT.target.length * 100);
  document.getElementById('ct-prog').textContent = p;
  document.getElementById('ct-bar').style.width = p + '%';
}

/* ---------- 입력 (붙여넣기·자동완성 막기) ---------- */
function ctBindInput() {
  var inp = document.getElementById('ct-inp'), wrap = document.getElementById('ct-wrap');
  function toEnd() { var n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} }
  ['paste', 'drop', 'cut', 'copy', 'contextmenu', 'dragstart'].forEach(function (n) {
    inp.addEventListener(n, function (e) { e.preventDefault(); });
    wrap.addEventListener(n, function (e) { e.preventDefault(); });
  });
  inp.addEventListener('beforeinput', function (e) {
    var t = e.inputType;
    if (t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertReplacementText' || t === 'historyUndo' || t === 'historyRedo' || t === 'insertFromYank') e.preventDefault();
  });
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!CT.skip && !e.isComposing && !CT.done) { inp.value += '    '; ctHandle(); }
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) > -1) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z', 'y'].indexOf(e.key.toLowerCase()) > -1) e.preventDefault();
  });
  wrap.addEventListener('mousedown', function (e) { e.preventDefault(); inp.focus(); toEnd(); });
  inp.addEventListener('compositionstart', function () {
    document.getElementById('ct-notice').textContent = '한글 입력 중이에요. 한/영 키로 영문으로 바꿔서 쳐요.';
  });
  inp.addEventListener('compositionend', function () {
    inp.value = inp.value.slice(0, CT.prev);
    toEnd();
  });
  inp.addEventListener('input', function (e) {
    if (e.isComposing) return;
    /* 한 번에 두 글자 이상 늘어나면(붙여넣기·자동완성) 되돌려요 */
    if (inp.value.length - CT.prev > 1 && e.inputType !== 'insertLineBreak') inp.value = inp.value.slice(0, CT.prev);
    ctHandle();
  });
}

function ctHandle() {
  var inp = document.getElementById('ct-inp'), t = CT.target, v = inp.value;
  if (CT.done) { inp.value = t; return; }
  if (v.length > t.length) v = v.slice(0, t.length);
  if (!CT.t0 && v.length) CT.t0 = Date.now();
  for (var i = CT.prev; i < v.length; i++) { CT.total++; if (v[i] !== t[i]) CT.wrong++; }
  /* 줄바꿈을 맞게 쳤으면 다음 줄 들여쓰기는 자동으로 건너뛰어요 (기록에는 안 셈) */
  if (CT.skip && v.length > CT.prev && v.length < t.length && v[v.length - 1] === '\n' && t[v.length - 1] === '\n') {
    while (t[v.length] === ' ') v += ' ';
  }
  inp.value = v;
  CT.prev = v.length;
  try { inp.setSelectionRange(v.length, v.length); } catch (e) {}
  if (v === t) ctFinish();
  document.getElementById('ct-notice').textContent = '';
  ctRender();
  ctStats();
}

function ctFinish() {
  CT.done = true;
  var sec = (Date.now() - CT.t0) / 1000;
  var good = Math.max(0, CT.total - CT.wrong);
  var cpm = Math.round(good / (sec / 60));
  var acc = Math.round(good / CT.total * 100);
  var old = ctBest(CT.lang, CT.idx);
  var isBest = !old || cpm > old.cpm;
  if (isBest) ctSaveBest(CT.lang, CT.idx, { cpm: cpm, acc: acc });
  ctBuildList();
  var last = CT.idx >= CT_DATA[CT.lang].items.length - 1;
  var el = document.getElementById('ct-done');
  el.innerHTML = '<div class="ct-done-msg">🎉 완료! <b>' + cpm + '타</b> · 정확도 <b>' + acc + '%</b> · ' + sec.toFixed(1) + '초' +
    (isBest ? ' · 👑 최고 기록!' : '') + '</div>' +
    (last ? '' : '<button class="btn btn-primary" onclick="ctSelect(' + (CT.idx + 1) + ')">다음 연습 ▶</button>');
  el.classList.add('on');
}
