/* ⌨️ 타자 연습 (혼자 하기)
   먼저 종류를 골라요:  💻 프로그래밍 언어 (Java · Python · C)   /   🖥️ SQL 터미널 (SQL*Plus 화면처럼)
   - 복사·붙여넣기·자동완성은 안 돼요. 한 글자씩 직접 쳐야 해요.
   - 한글도 직접 쳐요 (한글 입력 지원). 영문 코드 연습에서 한글을 치면 틀린 걸로 보여요.
   - SQL 터미널: 따옴표 안 글자(데이터)는 정확히, 나머지는 대소문자를 구분하지 않아요.
   - 타수(1분에 맞게 친 글자 수), 정확도, 시간을 재고 연습별 최고 기록을 저장해요.
   새 종류는 CT_TRACKS 와 CT_DATA 에 항목만 추가하면 돼요. */

var CT_TRACKS = {
  code: { name: '프로그래밍 언어', icon: '💻', desc: 'Java · Python · C 코드를 쳐요', lead: '연습할 언어를 골라요. 코드를 직접 치면서 문법을 몸에 익혀요.' },
  sql: { name: 'SQL 터미널', icon: '🖥️', desc: 'SQL*Plus 화면처럼 쿼리를 쳐요', lead: '연습할 프로그램을 골라요. 검은 터미널 창에서 SQL을 직접 쳐요.' },
  subway: { name: '지하철 역 이름', icon: '🚇', desc: '노선별 역 이름을 순서대로 쳐요', lead: '연습할 노선을 골라요. 역 이름을 순서대로 한글로 직접 쳐요.' }
};

var CT_DATA = {
  java: { track: 'code', name: 'Java', file: 'Main.java', color: '#F2836B', icon: '☕', items: [
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
  python: { track: 'code', name: 'Python', file: 'main.py', color: '#F2C744', icon: '🐍', items: [
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
  c: { track: 'code', name: 'C', file: 'main.c', color: '#7BB8F2', icon: '🔧', items: [
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

var CT_KW = {
  java: 'public|private|class|static|void|int|double|float|char|String|boolean|if|else|for|while|return|new|this|import|final|true|false|null',
  python: 'def|class|if|elif|else|for|while|return|in|import|from|print|True|False|None|and|or|not|range|self',
  c: 'int|double|float|char|void|if|else|for|while|return|struct|const|unsigned|sizeof|printf|scanf|NULL'
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

/* ================= SQL 터미널 ================= */
/* 연습 항목: [제목, 코드, 'long'(긴 쿼리)|'', 옵션]
   옵션: shell(윈도우 명령 프롬프트 줄) / out(끝난 뒤 보여줄 글) / rows(select 결과 줄 수, 순서대로) / noBanner */
var CT_SQL_CONNECT = ['접속하기 (sqlplus)', 'sqlplus system', '', { shell: true, noBanner: true, out: function () { return '\nEnter password: \n'; } }];

CT_DATA.sql_car = { track: 'sql', skin: 'term', name: '차량주행 관리', icon: '🚗', color: '#9ad1ff', items: [
  CT_SQL_CONNECT,
  ['부서 테이블 만들기', String.raw`create table TBL_DEPT (
    DEPT_CODE CHAR(2) NOT NULL PRIMARY KEY,
    DEPT_NAME VARCHAR2(14),
    DEPT_OFFR VARCHAR2(14)
);`],
  ['부서 데이터 넣기 (insert)', String.raw`INSERT INTO TBL_DEPT VALUES('10', '영업부', '김영업');
INSERT INTO TBL_DEPT VALUES('20', '총무부', '이총무');
INSERT INTO TBL_DEPT VALUES('30', '구매부', '박구매');
INSERT INTO TBL_DEPT VALUES('40', '개발부', '조개발');`],
  ['차량 테이블 만들기', String.raw`create table TBL_CAR (
    CAR_NO CHAR(10) NOT NULL PRIMARY KEY,
    CAR_MODEL VARCHAR2(14),
    CAR_COMPANY VARCHAR2(10),
    CAR_DATE CHAR(8)
);`],
  ['차량 데이터 넣기 (insert)', String.raw`INSERT INTO TBL_CAR VALUES('10가0001', '소나타', '현대', '20230101');
INSERT INTO TBL_CAR VALUES('10가0002', 'K5', '기아', '20230102');
INSERT INTO TBL_CAR VALUES('10가0003', 'SM5', '삼성', '20230103');
INSERT INTO TBL_CAR VALUES('10가0004', '그랜저', '현대', '20230104');
INSERT INTO TBL_CAR VALUES('10가0005', 'K5', '기아', '20230105');`],
  ['주행내역 테이블 (복합 기본키)', String.raw`CREATE TABLE TBL_DRIVE (
    DRV_DATE CHAR(8) NOT NULL,
    CAR_NO CHAR(10) NOT NULL,
    DRV_START NUMBER,
    DRV_END NUMBER,
    DEPT_CODE CHAR(2),
    DRV_MONEY NUMBER,
    PRIMARY KEY(DRV_DATE, CAR_NO)
);`],
  ['전체 조회 (select *)', String.raw`select * from TBL_DEPT;
select * from TBL_CAR;
select * from TBL_DRIVE;`, '', { rows: [4, 5, 10] }],
  ['차량 목록 날짜 형식으로', String.raw`select car_no,
    car_model,
    car_company,
    substr(car_date,1,4)||'년'||substr(car_date,5,2)||'월'||substr(car_date,7,2)||'일'
from tbl_car1;`, '', { rows: [5] }],
  ['주행내역 데이터 넣기 (insert 10줄)', String.raw`INSERT INTO TBL_DRIVE VALUES('20200301', '10가0001', 10000, 10100, '10', 20000);
INSERT INTO TBL_DRIVE VALUES('20200301', '10가0002', 10000, 10150, '10', 30000);
INSERT INTO TBL_DRIVE VALUES('20200301', '10가0003', 10000, 10200, '20', 30000);
INSERT INTO TBL_DRIVE VALUES('20200301', '10가0004', 10000, 10250, '30', 40000);
INSERT INTO TBL_DRIVE VALUES('20200301', '10가0005', 10000, 10300, '40', 40000);
INSERT INTO TBL_DRIVE VALUES('20200302', '10가0001', 10100, 10300, '10', 25000);
INSERT INTO TBL_DRIVE VALUES('20200302', '10가0002', 10150, 10300, '10', 20000);
INSERT INTO TBL_DRIVE VALUES('20200302', '10가0003', 10200, 10400, '20', 35000);
INSERT INTO TBL_DRIVE VALUES('20200302', '10가0004', 10250, 10500, '20', 40000);
INSERT INTO TBL_DRIVE VALUES('20200302', '10가0005', 10300, 10600, '30', 50000);`, 'long'],
  ['3개 테이블 조인하기', String.raw`select substr(c.drv_date,1,4)||'년'||substr(c.drv_date,5,2)||'월'||substr(c.drv_date,7,2)||'일' as c1,
    b.car_no,
    b.car_model,
    to_char(c.drv_start, '999,999') as c4,
    to_char(c.drv_end, '999,999') as c5,
    a.dept_name,
    '\'||to_char(c.drv_money, 'FM999,999') as c7
from tbl_dept1 a, tbl_car1 b, tbl_drive1 c
where a.dept_code=c.dept_code and b.car_no=c.car_no;`, 'long', { rows: [10] }],
  ['부서별 주행거리·주유금액 합계', String.raw`select a.dept_code,
    a.dept_name,
    sum(c.drv_end-drv_start),
    '\'||to_char(sum(drv_money), 'fm999,999')
from tbl_dept1 a, tbl_drive1 c
where a.dept_code = c.dept_code
group by (a.dept_code, a.dept_name);`, 'long', { rows: [4] }]
] };

CT_DATA.sql_patient = { track: 'sql', skin: 'term', name: '환자 검사', icon: '🏥', color: '#9be08f', items: [
  CT_SQL_CONNECT,
  ['환자 테이블 만들기', String.raw`create table kwai_patient4 (
    p_no       char(4) not null primary key,
    p_name     varchar2(20),
    p_birth    char(8),
    p_gender   char(1),
    p_tel1     char(3),
    p_tel2     char(4),
    p_tel3     char(4),
    p_city     char(2)
);`],
  ['환자 데이터 넣기 (insert)', String.raw`insert into kwai_patient4 values('1001', '김환자', '19850301', 'M', '010', '2222', '0001', '10');
insert into kwai_patient4 values('1002', '이환자', '19900301', 'M', '010', '2222', '0002', '20');
insert into kwai_patient4 values('1003', '박환자', '19770301', 'F', '010', '2222', '0003', '30');
insert into kwai_patient4 values('1004', '조환자', '19650301', 'F', '010', '2222', '0004', '10');
insert into kwai_patient4 values('1005', '황환자', '19400301', 'M', '010', '2222', '0005', '40');
insert into kwai_patient4 values('1006', '양환자', '19440301', 'F', '010', '2222', '0006', '40');
insert into kwai_patient4 values('1007', '허환자', '19760301', 'F', '010', '2222', '0007', '10');`],
  ['검사코드 테이블 만들기', String.raw`create table kwai_labtest4 (
    t_code char(4) not null primary key,
    t_name varchar2(20)
);`],
  ['검사코드 데이터 넣기', String.raw`insert into kwai_labtest4 values('T001', '결핵');
insert into kwai_labtest4 values('T002', '장티푸스');
insert into kwai_labtest4 values('T003', '수두');
insert into kwai_labtest4 values('T004', '홍역');
insert into kwai_labtest4 values('T005', '콜레라');`],
  ['검사결과 테이블 만들기', String.raw`create table kwai_result_2023 (
    p_se       number not null primary key,
    p_no       char(4),
    t_code     char(4),
    t_sdate    char(8),
    t_status   varchar2(4),
    t_idate    char(8),
    t_result   varchar2(4)
);`],
  ['검사결과 데이터 넣기 (insert 10줄)', String.raw`insert into kwai_result_2023 values(1, '1001', 'T001', '20200101', '1', '20200102', 'X');
insert into kwai_result_2023 values(2, '1002', 'T002', '20200101', '2', '20200102', 'P');
insert into kwai_result_2023 values(3, '1003', 'T003', '20200101', '2', '20200102', 'N');
insert into kwai_result_2023 values(4, '1004', 'T004', '20200101', '2', '20200102', 'P');
insert into kwai_result_2023 values(5, '1005', 'T005', '20200101', '2', '20200102', 'P');
insert into kwai_result_2023 values(6, '1006', 'T001', '20200101', '2', '20200102', 'N');
insert into kwai_result_2023 values(7, '1007', 'T002', '20200101', '2', '20200102', 'P');
insert into kwai_result_2023 values(8, '1005', 'T003', '20200101', '2', '20200102', 'P');
insert into kwai_result_2023 values(9, '1006', 'T004', '20200101', '2', '20200102', 'N');
insert into kwai_result_2023 values(10, '1007', 'T005', '20200101', '2', '20200102', 'N');
commit;`, 'long'],
  ['환자 정보 조회 (decode)', String.raw`select p_no,
       p_name,
       substr(p_birth, 1, 4) || '년' ||substr(p_birth, 5, 2) || '월' ||substr(p_birth, 7, 2) || '일',
       decode(p_gender, 'M', '남', 'F', '여'),
       p_tel1 || '-' || p_tel2 || '-' || p_tel3,
       decode(p_city, '10', '서울', '20', '경기', '30', '강원', '40', '대구')
from kwai_patient4
order by p_no;`, 'long', { rows: [7] }],
  ['환자별 검사결과 조회', String.raw`select a.p_no,
       a.p_name,
       b.t_name,
       substr(c.t_sdate, 1, 4) || '-' ||substr(c.t_sdate, 5, 2) || '-' ||substr(c.t_sdate, 7, 2),
       decode(c.t_status, '1', '검사 중', '2', '검사 완료'),
       substr(c.t_idate, 1, 4) || '-' ||substr(c.t_idate, 5, 2) || '-' ||substr(c.t_idate, 7, 2),
       decode(c.t_result, 'X', '미입력', 'P', '양성', 'N', '음성')
from kwai_patient4 a, kwai_labtest4 b, kwai_result_2023 c
where a.p_no = c.p_no and b.t_code = c.t_code
order by a.p_no asc;`, 'long', { rows: [10] }],
  ['지역별 검사건수', String.raw`select a.p_city 지역코드,
       decode(a.p_city, '10', '서울', '20', '경기', '30', '강원', '40', '대구') 지역명,
       count(b.p_se) 검사건수
from kwai_patient4 a,
     kwai_result_2023 b
where a.p_no = b.p_no
group by a.p_city,
         decode(a.p_city, '10', '서울', '20', '경기', '30', '강원', '40', '대구')
order by a.p_city;`, 'long', { rows: [4] }]
] };

CT_DATA.sql_store = { track: 'sql', skin: 'term', name: '매장관리', icon: '🏪', color: '#f2c744', items: [
  CT_SQL_CONNECT,
  ['매장 테이블 만들기', String.raw`create table TBL_STORE (
    store_code char(3) not null primary key,
    store_name varchar2(20),
    store_type char(1),
    founders_day char(8)
);`],
  ['매장 데이터 넣기 (insert)', String.raw`insert into TBL_STORE values ('100', '코엑스점', 'M', '20230101');
insert into TBL_STORE values ('200', '판교점', 'A', '20230202');
insert into TBL_STORE values ('300', '울산점', 'M', '20230303');
insert into TBL_STORE values ('400', '일산점', 'A', '20230404');`],
  ['매출 테이블 만들기', String.raw`create table TBL_SALES (
    store_code char(3) not null primary key,
    first number,
    second number,
    third number,
    fourth number
);`],
  ['매출 데이터 넣기 + commit', String.raw`insert into TBL_SALES values ('100', 10000, 20000, 30000, 40000);
insert into TBL_SALES values ('200', 5000, 2000, 10000, 15000);
insert into TBL_SALES values ('300', 15000, 30000, 10000, 10000);
commit;`],
  ['1단계 : 테이블 합치기 (조인)', String.raw`select *
from tbl_store a, tbl_sales b
where a.store_code = b.store_code;`, '', { rows: [3] }],
  ['2단계 : 필요한 컬럼 추출', String.raw`select a.store_name,
    first,
    second,
    third,
    fourth,
    first + second + third + fourth,
    founders_day
from tbl_store a, tbl_sales b
where a.store_code = b.store_code;`, 'long', { rows: [3] }],
  ['3단계 : 출력 형식 지정', String.raw`select a.store_name,
    to_char(first, '999,999'),
    second,
    third,
    fourth,
    first + second + third + fourth,
    substr(founders_day, 1, 4) || '년'
from tbl_store a, tbl_sales b
where a.store_code = b.store_code;`, 'long', { rows: [3] }]
] };

var CT = { lang: null, idx: 0, target: '', colors: [], strict: [], info: [], term: false, kr: false, t0: 0, total: 0, wrong: 0, prev: 0, done: false, comp: false, skip: true, timer: null, showTime: (function () { try { return localStorage.getItem('gamehub_ct_showtime') !== '0'; } catch (e) { return true; } })() };

function ctEsc(c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c; }

/* 글자마다 색 종류를 정해요 (키워드·문자열·숫자·주석) */
function ctColors(lang, code) {
  var cls = [], i;
  for (i = 0; i < code.length; i++) cls.push('d');
  if (!CT_KW[lang]) return cls;   /* SQL 터미널은 색 없이 (진짜 터미널처럼) */
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

/* 정확히 쳐야 하는 글자: 코드 연습은 전부, SQL은 따옴표 안(데이터)만 */
function ctStrictMap(term, code) {
  var s = [], i;
  for (i = 0; i < code.length; i++) s.push(!term);
  if (term) {
    var re = /'[^'\n]*'/g, m;
    while ((m = re.exec(code))) for (var k = m.index; k < m.index + m[0].length; k++) s[k] = true;
  }
  return s;
}
function ctEq(i, ch) {
  var t = CT.target[i];
  return CT.strict[i] ? ch === t : (ch === t || (ch && t && ch.toLowerCase() === t.toLowerCase()));
}
function ctSame(v) {
  if (v.length !== CT.target.length) return false;
  for (var i = 0; i < v.length; i++) if (!ctEq(i, v[i])) return false;
  return true;
}

/* SQL 터미널: 줄마다 프롬프트(SQL> / 2) 와 실행 결과(Table created. 등)를 미리 정해둬요 */
function ctTermInfo(code, opt) {
  var lines = code.split('\n'), info = [], stmt = [], rows = (opt && opt.rows ? opt.rows.slice() : []), shell = !!(opt && opt.shell);
  lines.forEach(function (line, n) {
    var o = { prompt: shell ? 'C:\\Users\\PC>' : (stmt.length === 0 ? 'SQL> ' : ('   ' + (stmt.length + 1)).slice(-3) + '  '), out: '' };
    stmt.push(line);
    if (shell) {
      if (n === lines.length - 1 && opt.out) o.out = typeof opt.out === 'function' ? opt.out() : opt.out;
    } else if (/;\s*$/.test(line)) {
      var s = stmt.join(' ');
      var m = '';
      if (/^\s*drop\s+table/i.test(s)) m = 'Table dropped.';
      else if (/^\s*create\s+table/i.test(s)) m = 'Table created.';
      else if (/^\s*insert/i.test(s)) m = '1 row created.';
      else if (/^\s*commit/i.test(s)) m = 'Commit complete.';
      else if (/^\s*select/i.test(s)) { var r = rows.length ? rows.shift() : 1; m = r + (r === 1 ? ' row selected.' : ' rows selected.'); }
      if (m) o.out = '\n' + m + '\n';
      stmt = [];
    }
    info.push(o);
  });
  return info;
}


/* 주제별 '전체 한 번에' 긴 연습: 각 SQL 주제의 항목들을 순서대로 이어붙여요 (접속 항목 제외) */
(function () {
  function countSel(code) {
    var n = 0, fresh = true;
    code.split('\n').forEach(function (l) {
      if (fresh && /^\s*select\b/i.test(l)) n++;
      if (/;\s*$/.test(l)) fresh = true; else fresh = false;
    });
    return n;
  }
  Object.keys(CT_DATA).forEach(function (id) {
    var D = CT_DATA[id];
    if (D.track !== 'sql') return;
    var codes = [], rows = [];
    D.items.forEach(function (it) {
      var o = it[3] || {};
      if (o.shell) return;
      codes.push(it[1]);
      var c = countSel(it[1]), r = o.rows ? o.rows.slice() : [];
      while (r.length < c) r.push(1);
      rows = rows.concat(r);
    });
    D.items.push(['📚 ' + D.name + ' 전체 한 번에', codes.join('\n'), 'long', { rows: rows, full: true }]);
  });
})();


/* 🚇 지하철: metro.js 의 노선 데이터로 연습 항목을 만들어요 (한 구간 10역씩 + 노선 전체) */
(function () {
  if (typeof MT_LINES === 'undefined') return;
  function rows(arr) { return arr.join(' '); }
  MT_LINES.forEach(function (L) {
    var items = [], st = L.st, n = st.length;
    for (var a = 0; a < n; a += 10) {
      var seg = st.slice(a, a + 10);
      items.push([L.name + ' · ' + seg[0] + ' → ' + seg[seg.length - 1], rows(seg)]);
    }
    if (n > 10) items.push(['📚 ' + L.name + ' 전체 (' + n + '역)', rows(st), 'long', { full: true }]);
    CT_DATA['sub_' + L.id] = { track: 'subway', kr: true, lid: L.id, num: L.num, name: L.name, file: L.name + '.txt', icon: '🚇', color: L.color, items: items };
  });
})();

/* ---------- 기록 ---------- */
function ctKey(l, i) { return 'gamehub_codetype_best_' + l + '_' + i; }
function ctBest(l, i) { try { return JSON.parse(localStorage.getItem(ctKey(l, i)) || 'null'); } catch (e) { return null; } }
function ctSaveBest(l, i, rec) { try { localStorage.setItem(ctKey(l, i), JSON.stringify(rec)); } catch (e) {} }
function ctDoneCount(id) { var n = 0; CT_DATA[id].items.forEach(function (_, i) { if (ctBest(id, i)) n++; }); return n; }

/* ---------- 화면: 종류 고르기 → 언어/프로그램 고르기 → 연습 ---------- */
function startCodeTypeGame() { stopCodeTypeGame(); ctShowTracks(); }
function stopCodeTypeGame() { clearInterval(CT.timer); CT.timer = null; }

function ctShowTracks() {
  stopCodeTypeGame();
  CT.lang = null;
  var html = '<div class="ct-langs"><p class="ct-lead">무엇을 연습할까요?</p><div class="ct-lang-row">';
  Object.keys(CT_TRACKS).forEach(function (id) {
    var T = CT_TRACKS[id], total = 0, done = 0;
    Object.keys(CT_DATA).forEach(function (k) { if (CT_DATA[k].track === id) { total += CT_DATA[k].items.length; done += ctDoneCount(k); } });
    html += '<button class="ct-lang ct-track" onclick="ctShowLang(\'' + id + '\')"><span class="ct-lang-ic">' + T.icon + '</span><b>' + T.name + '</b>' +
      '<small>' + T.desc + '</small><small>연습 ' + total + '개 · 완료 ' + done + '개</small></button>';
  });
  html += '</div></div>';
  document.getElementById('ct-root').innerHTML = html;
}

/* 지하철은 호선 색깔 동그라미(번호), 나머지는 이모지 아이콘 */
function ctIcon(D) {
  return D.num ? '<span class="ct-badge" style="background:' + D.color + '">' + D.num + '</span>' : D.icon;
}

function ctShowLang(track) {
  stopCodeTypeGame();
  CT.lang = null;
  var T = CT_TRACKS[track];
  var html = '<div class="ct-langs"><button class="ct-back ct-back-top" onclick="ctShowTracks()">← 종류 다시 고르기</button><p class="ct-lead">' + T.lead + '</p><div class="ct-lang-row">';
  Object.keys(CT_DATA).forEach(function (id) {
    var D = CT_DATA[id]; if (D.track !== track) return;
    html += '<button class="ct-lang' + (D.num ? ' ct-sub' : '') + '" style="--lc:' + D.color + '" onclick="ctPickLang(\'' + id + '\')">' +
      '<span class="ct-lang-ic">' + ctIcon(D) + '</span><b>' + D.name + '</b>' +
      '<small>연습 ' + D.items.length + '개 · 완료 ' + ctDoneCount(id) + '개</small></button>';
  });
  html += '</div></div>';
  document.getElementById('ct-root').innerHTML = html;
}

function ctPickLang(id) {
  CT.lang = id;
  var D = CT_DATA[id], term = D.skin === 'term';
  CT.kr = !!D.kr;
  var top = term
    ? '<div class="ct-term-top"><span class="ct-term-tab">▣ C:\\Users\\PC\\Desktop\\SQL연습 ✕</span><span class="ct-term-plus">＋ ⌄</span><span class="ct-term-wc">—  ☐  ✕</span></div>'
    : (D.track === 'subway' ? '' : '<div class="ct-editor-top"><i></i><i></i><i></i><span>' + D.file + '</span></div>');
  document.getElementById('ct-root').innerHTML =
    '<div class="ct-play' + (D.num ? ' sub' : '') + '" style="--lc:' + D.color + '">' +
      '<aside class="ct-side">' +
        '<button class="ct-back" onclick="ctShowLang(\'' + D.track + '\')">← 다시 고르기</button>' +
        '<div class="ct-side-title">' + ctIcon(D) + ' ' + D.name + '</div>' +
        '<div id="ct-list" class="ct-list"></div>' +
      '</aside>' +
      '<section class="ct-main">' +
        '<div class="ct-lesson" id="ct-lesson"></div>' +
        '<div class="ct-stats">' +
          '<span class="ct-st-time">⌨️ <b id="ct-cpm">0</b>타</span><span>🎯 <b id="ct-acc">100</b>%</span>' +
          '<span class="ct-st-time">⏱ <b id="ct-time">0.0</b>초</span><span>📈 <b id="ct-prog">0</b>%</span>' +
        '</div>' +
        '<div class="ct-bar"><div class="ct-bar-in" id="ct-bar"></div></div>' +
        '<div class="ct-editor' + (term ? ' ct-termwin' : '') + (D.track === 'subway' ? ' ct-metro' : '') + '">' + top +
          '<div class="ct-codewrap" id="ct-wrap"><div id="ct-banner" class="ct-banner"></div><div id="ct-code" class="ct-code"></div>' +
            '<textarea id="ct-inp" class="ct-inp" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="타자 입력"></textarea></div>' +
        '</div>' +
        '<div class="ct-notice" id="ct-notice"></div>' +
        '<div class="ct-done" id="ct-done"></div>' +
        '<div class="ct-btns">' +
          '<button class="btn btn-ghost" onclick="ctReset()">↻ 처음부터</button>' +
          '<button class="btn btn-ghost" id="ct-skipbtn" onclick="ctToggleSkip()"></button>' +
          '<button class="btn btn-ghost" id="ct-timebtn" onclick="ctToggleTime()"></button>' +
        '</div>' +
        '<p class="ct-help">' + (D.kr ? '한글 입력 상태에서 쳐요. 역 이름 사이는 띄어쓰기(스페이스)로 구분해요. 복사·붙여넣기와 자동완성은 막혀 있어요.' : term ? '한글도 직접 쳐요. 따옴표 안 글자는 정확히, 나머지는 대소문자 상관없어요. 복사·붙여넣기와 자동완성은 막혀 있어요.' : '영문 입력 상태에서 쳐요. 복사·붙여넣기와 자동완성은 막혀 있어요.') + '</p>' +
      '</section>' +
    '</div>';
  CT.term = term;
  ctBuildList();
  ctBindInput();
  clearInterval(CT.timer);
  CT.timer = setInterval(function () { if (CT.t0 && !CT.done) ctStats(); }, 300);
  ctSelect(0);
}

function ctBuildList() {
  var D = CT_DATA[CT.lang], html = '', prevLong = null, term = D.skin === 'term';
  D.items.forEach(function (it, i) {
    var isFull = !!(it[3] && it[3].full), isLong = isFull ? 'full' : it[2] === 'long';
    if (prevLong !== isLong) { html += '<div class="ct-grp">' + (isFull ? (D.kr ? '📚 노선 전체' : '📚 주제 전체 묶음') : isLong ? (term ? '📜 긴 쿼리' : '📜 긴 코드') : (D.kr ? '🚉 구간별' : '🌱 기본')) + '</div>'; prevLong = isLong; }
    var b = ctBest(CT.lang, i);
    html += '<button class="ct-item' + (i === CT.idx ? ' on' : '') + '" onclick="ctSelect(' + i + ')">' +
      '<span class="ct-item-name">' + it[0] + '</span>' +
      '<span class="ct-item-best">' + (b ? (b.cpm ? '👑 ' + b.cpm + '타' : '✅') : '') + '</span></button>';
  });
  document.getElementById('ct-list').innerHTML = html;
}

function ctSelect(i) {
  CT.idx = i;
  var D = CT_DATA[CT.lang], it = D.items[i], opt = it[3] || {};
  CT.target = it[1];
  CT.term = D.skin === 'term';
  CT.colors = ctColors(CT.lang, it[1]);
  CT.strict = ctStrictMap(CT.term, it[1]);
  CT.info = CT.term ? ctTermInfo(it[1], opt) : [];
  document.getElementById('ct-lesson').textContent = it[0];
  var bn = document.getElementById('ct-banner');
  bn.textContent = '';
  bn.style.display = 'none';   /* SQL*Plus 버전/저작권 안내 글은 보여주지 않아요 */
  ctBuildList();
  ctReset();
}

function ctToggleTime() {
  CT.showTime = !CT.showTime;
  try { localStorage.setItem('gamehub_ct_showtime', CT.showTime ? '1' : '0'); } catch (e) {}
  ctTimeLabel();
  var f = document.getElementById('ct-inp'); if (f) f.focus();
}
function ctTimeLabel() {
  var b = document.getElementById('ct-timebtn');
  if (b) b.textContent = CT.showTime ? '⏱ 시간·타수 보기: 켜짐' : '⏱ 시간·타수 보기: 꺼짐';
  document.querySelectorAll('.ct-st-time').forEach(function (e) { e.style.display = CT.showTime ? '' : 'none'; });
}
function ctToggleSkip() { CT.skip = !CT.skip; ctSkipLabel(); var f = document.getElementById('ct-inp'); if (f) f.focus(); }
function ctSkipLabel() {
  var b = document.getElementById('ct-skipbtn');
  if (b) b.style.display = CT.kr ? 'none' : '';
  if (b) b.textContent = CT.skip ? '↹ 들여쓰기 자동 건너뛰기: 켜짐' : '↹ 들여쓰기 자동 건너뛰기: 꺼짐 (Tab = 공백 4칸)';
}

function ctReset() {
  var inp = document.getElementById('ct-inp');
  if (!inp) return;
  inp.value = '';
  CT.t0 = 0; CT.total = 0; CT.wrong = 0; CT.prev = 0; CT.done = false; CT.comp = false;
  document.getElementById('ct-done').innerHTML = '';
  document.getElementById('ct-done').classList.remove('on');
  document.getElementById('ct-notice').textContent = '';
  ctSkipLabel();
  ctTimeLabel();
  ctRender();
  ctStats();
  inp.focus();
}


/* ---------- 🚇 메트로 스킨: 지도 위를 달리는 열차 + 하단 [이전 역 | 지금 칠 역 | 다음 역] 바 ---------- */
var CTM = { key: '', pts: [], els: [], n: 0 };
var CTM_SP = 170, CTM_CY = 118;
/* 어두운 지도 배경 (도로·공원·강). 가로세로로 이어 붙여도 끊기지 않게 그렸어요 */
var CTM_BG = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="340" viewBox="0 0 420 340">' +
  '<rect x="28" y="38" width="112" height="72" rx="20" fill="#1f4a3b" opacity=".55"/>' +
  '<rect x="236" y="190" width="130" height="86" rx="22" fill="#1f4a3b" opacity=".5"/>' +
  '<ellipse cx="338" cy="70" rx="48" ry="30" fill="#1f4a3b" opacity=".45"/>' +
  '<path d="M0 300 C100 268 150 332 260 300 S380 282 420 300" stroke="#2b4a73" stroke-width="14" fill="none" opacity=".55"/>' +
  '<path d="M0 150H420" stroke="#5a6678" stroke-width="7" opacity=".5"/>' +
  '<path d="M0 238H420" stroke="#5a6678" stroke-width="4" opacity=".45"/>' +
  '<path d="M96 0V340" stroke="#5a6678" stroke-width="6" opacity=".5"/>' +
  '<path d="M200 0V340" stroke="#5a6678" stroke-width="3" opacity=".4"/>' +
  '<path d="M292 0V340" stroke="#5a6678" stroke-width="5" opacity=".45"/>' +
  '<path d="M0 76H420" stroke="#5a6678" stroke-width="3" opacity=".35"/>' +
  '</svg>') + '")';

function ctmRgb(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/* 호선 색을 어두운 배경에서도 잘 보이게 밝게 (글자 맞게 쳤을 때 색) */
function ctmLight(c) { var r = ctmRgb(c); return 'rgb(' + r.map(function (x) { return Math.round(x + (255 - x) * 0.55); }).join(',') + ')'; }
/* 호선 색 위에 올릴 글자색 (밝은 호선은 검정 글자) */
function ctmText(c) { var r = ctmRgb(c); return (0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]) > 175 ? '#1d1d1f' : '#fff'; }
function ctmLine(D) { for (var i = 0; i < MT_LINES.length; i++) if (MT_LINES[i].id === D.lid) return MT_LINES[i]; return null; }
/* 역 번호: 호선 번호 + 순서 (2호선 첫 역 = 201). 신분당 D, 공항철도 A 로 시작해요 */
function ctmCode(L, name) {
  var k = L.st.indexOf(name); if (k < 0) return '';
  var n = k + 1;
  if (/^\d$/.test(L.num)) return String(Number(L.num) * 100 + n);
  return (L.id === 'sb' ? 'D' : L.id === 'ap' ? 'A' : '') + (n < 10 ? '0' : '') + n;
}
/* 이 역에서 갈아탈 수 있는 다른 호선들 */
function ctmXfer(L, name) {
  var out = [];
  MT_LINES.forEach(function (o) { if (o.id !== L.id && o.st.indexOf(name) > -1) out.push(o); });
  return out;
}
function ctmBadge(o) { return '<span class="ct-badge" style="background:' + o.color + ';color:' + ctmText(o.color) + '">' + o.num + '</span>'; }

/* 연습 항목이 바뀔 때 한 번만: 지도(노선·역·열차)를 그려 둬요. 타자 칠 때는 색·위치만 바뀌어요 */
function ctmBuild(D, key) {
  var L = ctmLine(D), names = CT.target.split(' '), n = names.length, pts = [], k, W, H = 260;
  for (k = 0; k < n; k++) pts.push({ x: 170 + k * CTM_SP, y: CTM_CY + 46 * Math.sin(k * 1.15) + 18 * Math.sin(k * 2.4 + 1) });
  W = 170 + (n - 1) * CTM_SP + 170;
  var all = pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  var svg = '<svg class="ctm-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<polyline class="ctm-base" points="' + all + '"/><polyline class="ctm-prog" id="ctm-prog" points=""/>';
  names.forEach(function (nm, i) {
    var xf = L ? ctmXfer(L, nm) : [], p = pts[i];
    svg += '<g class="ctm-s' + (xf.length ? ' xf' : '') + '" id="ctm-s' + i + '">' +
      (xf.length ? '<circle class="ctm-xo" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="14"/><circle class="ctm-xi" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7"/>'
                 : '<circle class="ctm-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9"/>') +
      '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 36).toFixed(1) + '" text-anchor="middle">' + ctEsc(nm) + '</text></g>';
  });
  svg += '</svg>';
  var tc = ctmText(D.color);
  var train = '<div class="ctm-train" id="ctm-train"><div class="ctm-train-in"><svg viewBox="0 0 48 48" width="52" height="52">' +
    '<rect x="6" y="8" width="36" height="29" rx="9" fill="' + D.color + '" stroke="#fff" stroke-width="3"/>' +
    '<rect x="11" y="13" width="11" height="10" rx="3" fill="' + tc + '"/><rect x="26" y="13" width="11" height="10" rx="3" fill="' + tc + '"/>' +
    '<circle cx="16" cy="30" r="2.6" fill="' + tc + '"/><circle cx="32" cy="30" r="2.6" fill="' + tc + '"/>' +
    '<rect x="12" y="38" width="7" height="4" rx="1.5" fill="#fff"/><rect x="29" y="38" width="7" height="4" rx="1.5" fill="#fff"/></svg></div></div>';
  document.getElementById('ct-code').innerHTML =
    '<div class="ctm-stage" id="ctm-stage" style="--lc:' + D.color + ';--lcl:' + ctmLight(D.color) + ';--lct:' + tc + '">' +
      '<div class="ctm-world nofx" id="ctm-world" style="width:' + W + 'px;height:' + H + 'px">' + svg + train + '</div>' +
      '<div class="ctm-top"><span class="ctm-line">' + ctIcon(D) + ' <b>' + ctEsc(D.name) + '</b>' + (L && L.sub ? ' <small>' + ctEsc(L.sub) + '</small>' : '') + '</span>' +
        '<span class="ctm-count"><b id="ctm-cur">1</b> / ' + n + '역</span></div>' +
      '<div class="ctm-hud" id="ctm-hud"></div>' +
    '</div>';
  document.getElementById('ctm-stage').style.backgroundImage = CTM_BG;
  CTM.key = key; CTM.pts = pts; CTM.n = n; CTM.els = [];
  for (k = 0; k < n; k++) CTM.els.push(document.getElementById('ctm-s' + k));
}

/* 지금 치는 역이 항상 화면 한가운데 오도록 지도를 밀어요 */
function ctmCamera(ci) {
  var st = document.getElementById('ctm-stage'), w = document.getElementById('ctm-world'), p = CTM.pts[ci];
  if (!st || !w || !p) return;
  var sw = st.clientWidth || 700;
  w.style.transform = 'translate(' + Math.round(sw / 2 - p.x) + 'px,' + Math.round(CTM_CY + 6 - p.y) + 'px)';
  st.style.backgroundPosition = Math.round((sw / 2 - p.x) * 0.5) + 'px ' + Math.round((CTM_CY - p.y) * 0.5) + 'px';
}
window.addEventListener('resize', function () { if (CTM.n && CT.lang && CT_DATA[CT.lang] && CT_DATA[CT.lang].track === 'subway') ctmCamera(CTM.ci || 0); });

function ctRenderMetro() {
  var D = CT_DATA[CT.lang], inp = document.getElementById('ct-inp');
  if (!D || !inp) return;
  var key = CT.lang + '|' + CT.idx, fresh = false;
  if (CTM.key !== key || !document.getElementById('ctm-stage')) { ctmBuild(D, key); fresh = true; }
  var v = inp.value, t = CT.target, names = t.split(' '), offs = [], p = 0, n = names.length, k, j;
  names.forEach(function (nm) { offs.push(p); p += nm.length + 1; });
  var compIdx = CT.comp && v.length ? v.length - 1 : -1;
  var ci = 0;
  for (k = 0; k < n; k++) { if (v.length >= offs[k]) ci = k; }
  CTM.ci = ci;
  var doneN = CT.done ? n : ci;
  /* 한 역(이름 + 뒤 띄어쓰기)을 치는 동안 틀린 글자가 있었는지 */
  function missed(s) {
    var from = offs[s], to = Math.min(v.length, offs[s] + names[s].length + 1);
    for (var i = from; i < to; i++) { if (i === compIdx) continue; if (!ctEq(i, v[i])) return true; }
    return false;
  }

  /* 지도: 지나온 역은 칠해지고, 지금 역은 커지고, 열차가 거기 서 있어요 */
  var pts = CTM.pts, prog = [];
  for (k = 0; k < n; k++) {
    var cls = 'ctm-s' + (CTM.els[k].getAttribute('class').indexOf(' xf') > -1 ? ' xf' : '') + (k < doneN ? (missed(k) ? ' done miss' : ' done') : (k === ci ? ' cur' : ''));
    CTM.els[k].setAttribute('class', cls);
    if (k <= (CT.done ? n - 1 : ci)) prog.push(pts[k].x.toFixed(1) + ',' + pts[k].y.toFixed(1));
  }
  document.getElementById('ctm-prog').setAttribute('points', prog.length > 1 ? prog.join(' ') : '');
  var tr = document.getElementById('ctm-train'), tp = pts[CT.done ? n - 1 : ci];
  tr.style.left = (tp.x - 26) + 'px'; tr.style.top = (tp.y - 62) + 'px';
  ctmCamera(CT.done ? n - 1 : ci);
  if (fresh) { var wd = document.getElementById('ctm-world'); setTimeout(function () { wd.classList.remove('nofx'); }, 60); }
  document.getElementById('ctm-cur').textContent = Math.min(doneN + (CT.done ? 0 : 1), n);

  /* 하단 바: 이전 역 | 지금 칠 역 | 다음 역 */
  var L = ctmLine(D), nm = names[CT.done ? n - 1 : ci], cidx = CT.done ? n - 1 : ci, chars = '';
  for (j = 0; j < nm.length; j++) {
    var i2 = offs[cidx] + j, st = '';
    if (i2 < v.length) st = i2 === compIdx ? (ctEq(i2, v[i2]) ? 'comp ok' : 'comp') : (ctEq(i2, v[i2]) ? 'ok' : 'bad');
    else if (i2 === v.length && !CT.done) st = 'cur';
    chars += '<span class="ctm-ch ' + st + '">' + ctEsc(nm[j]) + '</span>';
  }
  var prevN = cidx > 0 ? names[cidx - 1] : null, nextN = cidx < n - 1 ? names[cidx + 1] : null;
  var prevBad = prevN && !CT.done && missed(cidx - 1) && v.length >= offs[cidx];
  function cd(name) { return L ? '<span class="ctm-cd">' + ctmCode(L, name) + '</span>' : ''; }
  var prevH = '<div class="ctm-pill prev' + (prevN ? '' : ' none') + (prevBad ? ' bad' : '') + '"><span class="ctm-arr">←</span>' +
    '<span class="ctm-pi">' + (prevN ? cd(prevN) : '') + '<span class="ctm-pn"><small>이전 역</small><b>' + (prevN ? ctEsc(prevN) : '출발') + '</b></span></span></div>';
  var nextH = '<div class="ctm-pill next' + (nextN ? '' : ' none') + '">' +
    '<span class="ctm-pi"><span class="ctm-pn"><small>다음 역</small><b>' + (nextN ? ctEsc(nextN) : '종착') + '</b></span>' + (nextN ? cd(nextN) : '') + '</span><span class="ctm-arr">→</span></div>';
  var waitSp = !CT.done && !CT.comp && cidx < n - 1 && v.length === offs[cidx] + nm.length;
  var xf = L ? ctmXfer(L, nm) : [], tag;
  if (CT.done) tag = '<span class="ctm-tag go">🎉 종착역 도착!</span>';
  else if (waitSp) tag = '<span class="ctm-tag go"><kbd>Space</kbd> 다음 역으로 출발</span>';
  else if (xf.length) tag = '<span class="ctm-tag">환승 ' + xf.map(ctmBadge).join('') + '</span>';
  else tag = '';
  var fs = nm.length > 7 ? 30 : nm.length > 5 ? 38 : 46;
  document.getElementById('ctm-hud').innerHTML = prevH +
    '<div class="ctm-center">' + tag + '<span class="ctm-cbadge">' + (L ? ctmCode(L, nm) : '') + '</span>' +
      '<span class="ctm-nm" style="--fs:' + fs + 'px;--len:' + nm.length + '">' + chars + '</span></div>' + nextH;
}

/* ---------- 그리기 ---------- */
function ctRender() {
  if (CT_DATA[CT.lang] && CT_DATA[CT.lang].track === 'subway') { ctRenderMetro(); return; }
  var v = document.getElementById('ct-inp').value, t = CT.target, html = '', i = 0, term = CT.term;
  var lines = t.split('\n'), last = lines.length - 1;
  var compIdx = CT.comp && v.length ? v.length - 1 : -1;   /* 한글을 조합하는 중인 글자 */
  for (var n = 0; n <= last; n++) {
    html += '<div class="ct-ln"><span class="ct-no">' + (term ? ctEsc(CT.info[n].prompt) : (n + 1)) + '</span><span class="ct-tx">';
    var line = lines[n];
    for (var k = 0; k <= line.length; k++, i++) {
      var isNl = (k === line.length);
      if (isNl && n === last) break;
      var c = isNl ? '\n' : line[k];
      var st = '';
      if (i < v.length) st = i === compIdx ? 'comp' : (ctEq(i, v[i]) ? 'ok' : 'bad');
      else if (i === v.length && !CT.done) st = 'cur';
      var cl = 'ct-c ' + CT.colors[i] + (st ? ' ' + st : '');
      var tp = (st === 'bad' && !CT.kr && !isNl && v[i] && v[i] !== ' ' && v[i] !== c) ? ' data-t="' + ctEsc(v[i]).replace(/"/g, '&quot;') + '"' : '';
      if (isNl) html += '<span class="' + cl + ' nl">↵</span>';
      else if (c === ' ' && st === 'bad') html += '<span class="' + cl + '">·</span>';
      else html += '<span class="' + cl + '"' + tp + '>' + ctEsc(c) + '</span>';
    }
    html += '</span></div>';
    /* 줄을 끝까지 치고 Enter를 누르면 실행 결과가 나와요 */
    if (term && CT.info[n].out && (n < last ? v.length >= i : CT.done)) html += '<div class="ct-out">' + ctEsc(CT.info[n].out) + '</div>';
  }
  document.getElementById('ct-code').innerHTML = html;
  /* 영문을 쳐야 하는데 한글로 입력 중이면 바로 알려줘요 */
  var hg = /[\u3131-\u318E\uAC00-\uD7A3]/, hw = false;
  for (var j = 0; j < v.length && !hw; j++) { if (hg.test(v[j]) && !hg.test(t[j] || '')) hw = true; }
  var nt = document.getElementById('ct-notice');
  if (nt) {
    if (hw) { nt.textContent = '⚠️ 지금 한글로 입력되고 있어요! 빨간 글자 위에 작게 보이는 게 내가 친 글자예요. 한/영 키로 영문으로 바꿔서 쳐요.'; CT.hnote = true; }
    else if (CT.hnote) { nt.textContent = ''; CT.hnote = false; }
  }
}

function ctStats() {
  var inp = document.getElementById('ct-inp');
  if (!inp) return;
  var v = inp.value, ok = 0;
  for (var i = 0; i < v.length; i++) if (ctEq(i, v[i])) ok++;
  var sec = CT.t0 ? (Date.now() - CT.t0) / 1000 : 0;
  var good = Math.max(0, CT.total - CT.wrong);
  document.getElementById('ct-cpm').textContent = sec > 0.5 ? Math.round(good / (sec / 60)) : 0;
  document.getElementById('ct-acc').textContent = CT.total ? Math.round(good / CT.total * 100) : 100;
  document.getElementById('ct-time').textContent = sec.toFixed(1);
  var p = Math.round(ok / CT.target.length * 100);
  document.getElementById('ct-prog').textContent = p;
  document.getElementById('ct-bar').style.width = p + '%';
}

/* ---------- 입력 (붙여넣기·자동완성 막기, 한글 조합 처리) ---------- */
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
  wrap.addEventListener('mousedown', function (e) { e.preventDefault(); inp.focus(); if (!CT.comp) toEnd(); });
  /* 한글: 조합 중인 글자는 맞다/틀리다 정하지 않고, 조합이 끝나면 그때 채점해요 */
  inp.addEventListener('compositionstart', function () {
    CT.comp = true;
    if (!CT.term && !CT.kr) document.getElementById('ct-notice').textContent = '한글 입력 중이에요. 한/영 키로 영문으로 바꿔서 쳐요.';
  });
  inp.addEventListener('compositionend', function () {
    CT.comp = false;
    if (inp.value.length - CT.prev > 2) inp.value = inp.value.slice(0, CT.prev);   /* 한꺼번에 많이 들어오면 되돌려요 */
    ctHandle();
  });
  inp.addEventListener('input', function (e) {
    if (e.isComposing || CT.comp) {
      /* 마지막 글자를 조합하는 중에 정답과 똑같아지면 바로 끝낼 수 있게 (안 그러면 다른 키를 한 번 더 눌러야 끝나요) */
      if (!CT.done && inp.value.length === CT.target.length && ctSame(inp.value)) { CT.comp = false; ctHandle(); return; }
      ctRender(); return;
    }
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
  /* 아직 조합 중인(막 시작된) 마지막 한글 글자는 채점을 미뤄요: 완성되기 전 낱자모가 '틀림'(빨간색)으로 세어지지 않게 */
  var lim = v.length;
  if (lim && (CT.comp || (/[\u3131-\u318E]/.test(v[lim - 1]) && v[lim - 1] !== t[lim - 1]))) lim--;
  for (var i = CT.prev; i < lim; i++) { CT.total++; if (!ctEq(i, v[i])) CT.wrong++; }
  /* 줄바꿈을 맞게 쳤으면 다음 줄 들여쓰기는 자동으로 건너뛰어요 (기록에는 안 셈) */
  if (CT.skip && v.length > CT.prev && v.length < t.length && v[v.length - 1] === '\n' && t[v.length - 1] === '\n') {
    while (t[v.length] === ' ') v += ' ';
  }
  if (inp.value !== v) inp.value = v;
  CT.prev = lim;
  if (!CT.comp) { try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  if (lim === v.length && ctSame(v)) ctFinish();
  document.getElementById('ct-notice').textContent = CT.comp && !CT.term && !CT.kr ? document.getElementById('ct-notice').textContent : '';
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
  var isBest = CT.showTime && (!old || !old.cpm || cpm > old.cpm);
  if (isBest) ctSaveBest(CT.lang, CT.idx, { cpm: cpm, acc: acc });
  else if (!old) ctSaveBest(CT.lang, CT.idx, { cpm: 0, acc: acc });
  ctBuildList();
  var last = CT.idx >= CT_DATA[CT.lang].items.length - 1;
  var el = document.getElementById('ct-done');
  el.innerHTML = '<div class="ct-done-msg">🎉 완료! ' + (CT.showTime ? '<b>' + cpm + '타</b> · ' : '') + '정확도 <b>' + acc + '%</b>' + (CT.showTime ? ' · ' + sec.toFixed(1) + '초' : '') +
    (isBest ? ' · 👑 최고 기록!' : '') + '</div>' +
    (last ? '' : '<button class="btn btn-primary" onclick="ctSelect(' + (CT.idx + 1) + ')">다음 연습 ▶</button>');
  el.classList.add('on');
}
