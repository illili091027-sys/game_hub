/* 영어 낱말 찾기 단어장 - [영어, 뜻] / 티어가 올라갈수록 길고 어려운 단어 */
var WS_WORD_TIERS = {
  1: [
    ['CAT','고양이'],['DOG','개'],['SUN','해'],['MOON','달'],['STAR','별'],['FISH','물고기'],['BIRD','새'],['TREE','나무'],
    ['BOOK','책'],['PEN','펜'],['RED','빨간색'],['BLUE','파란색'],['CAKE','케이크'],['MILK','우유'],['EGG','달걀'],['HAT','모자'],
    ['BAG','가방'],['CUP','컵'],['BED','침대'],['BUS','버스'],['CAR','자동차'],['RAIN','비'],['SNOW','눈'],['BEAR','곰'],
    ['LION','사자'],['FROG','개구리'],['DUCK','오리'],['DESK','책상'],['DOOR','문'],['HAND','손'],['FOOT','발'],['NOSE','코'],
    ['EYE','눈(신체)'],['EAR','귀'],['ARM','팔'],['LEG','다리'],['PIG','돼지'],['COW','소'],['HEN','암탉'],['ANT','개미'],
    ['BEE','벌'],['BOX','상자'],['TOY','장난감'],['KEY','열쇠'],['MAP','지도'],['SKY','하늘'],['SEA','바다'],['ICE','얼음'],
    ['HOT','뜨거운'],['COLD','차가운'],['BIG','큰'],['RUN','달리다'],['SING','노래하다'],['JUMP','뛰다'],['SWIM','수영하다'],['READ','읽다'],
    ['GAME','게임'],['BALL','공'],['SHIP','배'],['KITE','연'],['RICE','밥'],['SOUP','수프'],['TEN','10'],['ONE','1']
  ],
  2: [
    ['APPLE','사과'],['BREAD','빵'],['CHAIR','의자'],['HOUSE','집'],['WATER','물'],['MOUSE','쥐'],['TIGER','호랑이'],['HORSE','말'],
    ['SHEEP','양'],['ZEBRA','얼룩말'],['GRAPE','포도'],['LEMON','레몬'],['PEACH','복숭아'],['MELON','멜론'],['PIZZA','피자'],['CANDY','사탕'],
    ['CLOCK','시계'],['PHONE','전화기'],['TABLE','탁자'],['RIVER','강'],['CLOUD','구름'],['PLANT','식물'],['MUSIC','음악'],['PAPER','종이'],
    ['GREEN','초록색'],['BLACK','검은색'],['WHITE','흰색'],['HAPPY','행복한'],['SMILE','미소'],['DANCE','춤추다'],['SLEEP','자다'],['WRITE','쓰다'],
    ['ORANGE','오렌지'],['BANANA','바나나'],['SCHOOL','학교'],['FRIEND','친구'],['FAMILY','가족'],['MONKEY','원숭이'],['RABBIT','토끼'],['SUMMER','여름'],
    ['WINTER','겨울'],['SPRING','봄'],['GARDEN','정원'],['FLOWER','꽃'],['PENCIL','연필'],['WINDOW','창문'],['FOREST','숲'],['ISLAND','섬'],
    ['SNAKE','뱀'],['WHALE','고래'],['SHARK','상어'],['TRAIN','기차'],['PLANE','비행기'],['BEACH','해변'],['NIGHT','밤'],['MONEY','돈']
  ],
  3: [
    ['TEACHER','선생님'],['CHICKEN','닭'],['KITCHEN','부엌'],['BROTHER','형제'],['SISTER','자매'],['WEATHER','날씨'],['BICYCLE','자전거'],['PICTURE','그림'],
    ['MORNING','아침'],['EVENING','저녁'],['HOLIDAY','휴일'],['PENGUIN','펭귄'],['GIRAFFE','기린'],['DOLPHIN','돌고래'],['DRAGON','용'],['CASTLE','성'],
    ['PLANET','행성'],['ROCKET','로켓'],['DOCTOR','의사'],['FARMER','농부'],['SINGER','가수'],['ARTIST','예술가'],['SOCCER','축구'],['TENNIS','테니스'],
    ['COOKIE','쿠키'],['CHEESE','치즈'],['BUTTER','버터'],['TOMATO','토마토'],['POTATO','감자'],['CARROT','당근'],['ORANGE','오렌지'],['YELLOW','노란색'],
    ['PURPLE','보라색'],['SILVER','은'],['GOLDEN','금빛의'],['MIRROR','거울'],['BRIDGE','다리(건축)'],['STREET','거리'],['MARKET','시장'],['LETTER','편지'],
    ['NUMBER','숫자'],['ANSWER','대답'],['QUESTION','질문'],['SCIENCE','과학'],['HISTORY','역사'],['COUNTRY','나라'],['VILLAGE','마을'],['STUDENT','학생'],
    ['CAMERA','카메라'],['GUITAR','기타'],['VIOLIN','바이올린'],['JACKET','재킷'],['POCKET','주머니'],['BASKET','바구니']
  ],
  4: [
    ['ELEPHANT','코끼리'],['DINOSAUR','공룡'],['UMBRELLA','우산'],['BIRTHDAY','생일'],['HOSPITAL','병원'],['COMPUTER','컴퓨터'],['LIBRARY','도서관'],['MOUNTAIN','산'],
    ['KANGAROO','캥거루'],['SQUIRREL','다람쥐'],['MUSHROOM','버섯'],['PINEAPPLE','파인애플'],['SANDWICH','샌드위치'],['NOTEBOOK','공책'],['SWEATER','스웨터'],['AIRPORT','공항'],
    ['MUSEUM','박물관'],['RAINBOW','무지개'],['THUNDER','천둥'],['VOLCANO','화산'],['DESERT','사막'],['JOURNEY','여행'],['COURAGE','용기'],['FREEDOM','자유'],
    ['EXERCISE','운동'],['SHOULDER','어깨'],['STOMACH','배(신체)'],['CALENDAR','달력'],['HOMEWORK','숙제'],['CLASSROOM','교실'],['FESTIVAL','축제'],['TREASURE','보물'],
    ['PRINCESS','공주'],['SOLDIER','군인'],['SCIENTIST','과학자'],['DETECTIVE','탐정'],['ENGINEER','기술자'],['MAGICIAN','마술사'],['PAINTING','그림(회화)'],['MAGAZINE','잡지'],
    ['SUBWAY','지하철'],['TRAFFIC','교통'],['NEIGHBOR','이웃'],['ANIMAL','동물'],['OCTOPUS','문어'],['TURTLE','거북'],['SPIDER','거미'],['BEAUTIFUL','아름다운'],
    ['DIFFERENT','다른'],['DANGEROUS','위험한'],['IMPORTANT','중요한'],['TOMORROW','내일'],['YESTERDAY','어제'],['TOGETHER','함께']
  ],
  5: [
    ['ADVENTURE','모험'],['BUTTERFLY','나비'],['CHOCOLATE','초콜릿'],['DICTIONARY','사전'],['EXPERIMENT','실험'],['TEMPERATURE','온도'],['CROCODILE','악어'],['STRAWBERRY','딸기'],
    ['WATERMELON','수박'],['BASKETBALL','농구'],['BADMINTON','배드민턴'],['TELEVISION','텔레비전'],['REFRIGERATOR','냉장고'],['ENVIRONMENT','환경'],['IMAGINATION','상상력'],['UNIVERSITY','대학교'],
    ['PHOTOGRAPH','사진'],['ASTRONAUT','우주비행사'],['HELICOPTER','헬리콥터'],['SUBMARINE','잠수함'],['LIGHTHOUSE','등대'],['WATERFALL','폭포'],['HURRICANE','허리케인'],
    ['EARTHQUAKE','지진'],['ATMOSPHERE','대기'],['GALAXY','은하'],['TELESCOPE','망원경'],['MICROSCOPE','현미경'],['CHAMPION','챔피언'],['COMPETITION','대회'],['CELEBRATION','축하'],
    ['CONVERSATION','대화'],['INFORMATION','정보'],['RESTAURANT','식당'],['SUPERMARKET','슈퍼마켓'],['APARTMENT','아파트'],['NEWSPAPER','신문'],['ORCHESTRA','오케스트라'],['VOCABULARY','어휘'],
    ['MATHEMATICS','수학'],['GEOGRAPHY','지리'],['GRANDMOTHER','할머니'],['GRANDFATHER','할아버지'],['EXCELLENT','훌륭한'],['INTERESTING','흥미로운'],['WONDERFUL','멋진'],['COMFORTABLE','편안한'],
    ['DELICIOUS','맛있는'],['FRIENDSHIP','우정'],['KNOWLEDGE','지식'],['DISCOVERY','발견'],['PENGUIN','펭귄'],['ELEPHANT','코끼리']
  ]
};
