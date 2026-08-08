import "server-only";

import {
  serializePublicCase,
  serializePublicCases,
} from "../domain/cases";
import type { CaseDefinition } from "../domain/types";

/**
 * `game.txt` is the organizer-provided source for the nine playable cases.
 * Secret facts stay in this server-only module and must only leave the server
 * through the explicit public-case serializers.
 */
export const HAS_GAME_RULES = true;

export const CASES: readonly CaseDefinition[] = [
  {
    id: "case-01",
    number: 1,
    title: "Cái chết trong căn phòng trống",
    difficulty:
      "3.5/5 (Thiên về tư duy logic vật lý và suy luận không gian)",
    publicStory:
      "Một người đàn ông được tìm thấy đã chết trong tư thế treo cổ ngay chính giữa một căn phòng hoàn toàn trống không. Căn phòng trống trơn, không có bàn, không có ghế, không có bất kỳ đồ đạc hay vật nâng đỡ nào. Cửa phòng được khóa trái từ bên trong. Dưới sàn nhà chỉ có một vũng nước nhỏ ngay dưới chân anh ta. Cảnh sát xác định đây là một vụ tự tử. Hỏi anh ta đã treo cổ bằng cách nào?",
    coreFacts: [
      {
        id: "case-01-core-01",
        text: "Người đàn ông tự tử; không có người khác giết anh ta.",
      },
      {
        id: "case-01-core-02",
        text: "Anh ta mang vào phòng một khối đá lạnh lớn và dày rồi trèo lên đó làm điểm tựa.",
      },
      {
        id: "case-01-core-03",
        text: "Anh ta buộc dây thừng vào xà nhà, tròng dây vào cổ và khóa kín căn phòng.",
      },
      {
        id: "case-01-core-04",
        text: "Nhiệt độ phòng làm khối đá tan hoàn toàn thành vũng nước, khiến anh ta mất điểm tựa và bị treo lơ lửng.",
      },
      {
        id: "case-01-core-05",
        text: "Vũng nước dưới chân trước đó là khối đá ở trạng thái rắn.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-01-false-01",
        text: "Cái chết không phải là một vụ giết người.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-01-required-01",
        text: "Người đàn ông dùng một khối băng hoặc đá lạnh làm vật nâng đỡ để tự treo cổ.",
      },
      {
        id: "case-01-required-02",
        text: "Khối băng tan thành vũng nước và làm điểm tựa biến mất.",
      },
    ],
    optionalFacts: [
      {
        id: "case-01-optional-01",
        text: "Dây được buộc vào xà nhà và căn phòng được khóa kín.",
      },
    ],
    acceptedAlternatives: [
      "Có thể gọi vật nâng đỡ là khối băng, tảng băng, khối nước đá hoặc khối đá lạnh.",
    ],
    irrelevantExamples: [],
    unsupportedDetails: [],
    needsReview: false,
    enabled: true,
    reviewNotes: [],
  },
  {
    id: "case-02",
    number: 2,
    title: "Tiếng còi định mệnh",
    difficulty: "4/5 (Thiên về tư duy nhân quả, logic tâm lý xã hội)",
    publicStory:
      "Một người đàn ông đang ngồi trong một toa tàu ngầm đang chạy. Khi tàu đi qua một đường hầm tối, anh ta đột ngột rút súng tự sát. Anh ta là một người hoàn toàn bình thường, không có bệnh lý tâm thần, không nợ nần, cuộc sống đang rất hạnh phúc. Tại sao anh ta lại làm vậy?",
    coreFacts: [
      {
        id: "case-02-core-01",
        text: "Người đàn ông bị mù bẩm sinh và vừa trải qua một ca phẫu thuật mắt thành công.",
      },
      {
        id: "case-02-core-02",
        text: "Đây là lần đầu tiên trong đời anh ta nhìn thấy ánh sáng và thế giới xung quanh.",
      },
      {
        id: "case-02-core-03",
        text: "Khi phương tiện đi vào đường hầm tối, anh ta chưa hiểu hiện tượng này và tưởng ca phẫu thuật đã thất bại, khiến mình mù vĩnh viễn trở lại.",
      },
      {
        id: "case-02-core-04",
        text: "Cú sốc và tuyệt vọng vì nghĩ mình bị mù trở lại khiến anh ta tự sát.",
      },
      {
        id: "case-02-core-05",
        text: "Đề bài gọi phương tiện là một toa tàu ngầm, còn đáp án bí mật gọi đó là tàu hỏa trên đường từ bệnh viện về nhà.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-02-false-01",
        text: "Anh ta không tự sát vì sợ bóng tối.",
      },
      {
        id: "case-02-false-02",
        text: "Anh ta không có bệnh lý tâm thần, không nợ nần và trước sự việc đang có cuộc sống hạnh phúc.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-02-required-01",
        text: "Anh ta bị mù bẩm sinh và vừa được phẫu thuật mắt thành công.",
      },
      {
        id: "case-02-required-02",
        text: "Bóng tối khi đi qua đường hầm khiến anh ta tưởng mình đã mù trở lại hoặc ca phẫu thuật đã thất bại.",
      },
      {
        id: "case-02-required-03",
        text: "Sự hiểu lầm đó khiến anh ta tuyệt vọng và tự sát.",
      },
    ],
    optionalFacts: [
      {
        id: "case-02-optional-01",
        text: "Anh ta đang trên đường từ bệnh viện trở về nhà.",
      },
    ],
    acceptedAlternatives: [
      "Chấp nhận cách diễn đạt rằng anh ta tưởng bệnh mù tái phát, tưởng mình mất thị lực lần nữa hoặc tưởng ca mổ mắt thất bại.",
    ],
    irrelevantExamples: [],
    unsupportedDetails: [
      "Không được tự chọn tàu ngầm hay tàu hỏa làm canon: hai phần của nguồn dùng hai loại phương tiện khác nhau.",
    ],
    needsReview: true,
    enabled: true,
    reviewNotes: [
      "Nguồn mâu thuẫn về phương tiện: đề bài viết “toa tàu ngầm”, trong khi đáp án bí mật viết “tàu hỏa”. Giữ nguyên cả hai; câu hỏi Có/Không phụ thuộc loại phương tiện phải được phán quyết KHONG_QUAN_TRONG.",
    ],
  },
  {
    id: "case-03",
    number: 3,
    title: "Hộp diêm định mệnh",
    difficulty:
      "4.5/5 (Thiên về logic toán học, xác suất và bài toán loại trừ nhóm)",
    publicStory:
      "Một người đàn ông trung niên được tìm thấy đã chết tại một khu rừng hoang dã. Bên cạnh xác anh ta không có dấu vết ẩu đả, không có hung khí, chỉ có duy nhất một hộp diêm còn nguyên, bên trong chứa đầy các que diêm chưa từng được quẹt. Khám nghiệm tử thi cho thấy anh ta chết vì một phát đạn bắn thẳng vào tim. Cảnh sát kết luận đây là một vụ giết người và hộp diêm chính là bằng chứng tố cáo kẻ thủ ác. Tại sao hộp diêm chưa quẹt lại liên quan đến phát đạn?",
    coreFacts: [
      {
        id: "case-03-core-01",
        text: "Nạn nhân và hung thủ tranh chấp rồi quyết định đấu súng tay đôi: quay lưng, đi số bước bằng nhau, quay lại và bắn.",
      },
      {
        id: "case-03-core-02",
        text: "Hung thủ gian lận trong cuộc đấu súng và đánh rơi hộp diêm của mình khi bỏ chạy.",
      },
      {
        id: "case-03-core-03",
        text: "Nguồn nêu một cơ chế là hung thủ lén đặt hộp diêm đầy vào túi áo ngực nạn nhân để làm mục tiêu định vị.",
      },
      {
        id: "case-03-core-04",
        text: "Nguồn cũng nêu một cơ chế khác là hung thủ dùng các que diêm trong túi mình để đếm chính xác số bước trong bóng tối, nhằm chiếm lợi thế khoảng cách và góc bắn.",
      },
      {
        id: "case-03-core-05",
        text: "Nguồn còn gọi chi tiết sâu sắc nhất là hung thủ mù dùng tiếng lách cách khi lắc hộp diêm để xác định hướng đối thủ trước khi bắn.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-03-false-01",
        text: "Hộp diêm không được dùng để kích nổ khẩu súng.",
      },
      {
        id: "case-03-false-02",
        text: "Hộp diêm được xác định là của hung thủ, không phải của nạn nhân.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-03-required-01",
        text: "Nạn nhân bị bắn trong một cuộc đấu súng tay đôi với hung thủ.",
      },
      {
        id: "case-03-required-02",
        text: "Hung thủ dùng hộp diêm hoặc các que diêm để gian lận trong việc định vị, đo khoảng cách hoặc xác định phương hướng khi bắn.",
      },
      {
        id: "case-03-required-03",
        text: "Hộp diêm thuộc về hung thủ và bị hắn đánh rơi tại hiện trường.",
      },
    ],
    optionalFacts: [
      {
        id: "case-03-optional-01",
        text: "Cuộc đấu súng diễn ra theo luật hai người đi số bước bằng nhau rồi quay lại bắn.",
      },
    ],
    acceptedAlternatives: [
      "Nguồn cho phép cơ chế đếm que diêm hoặc số bước để kiểm soát khoảng cách.",
      "Nguồn cho phép cơ chế lắc hộp diêm tạo tiếng động để định hướng đối thủ.",
      "Nguồn cho phép cơ chế đặt hộp diêm trong túi áo ngực nạn nhân làm mục tiêu định vị.",
    ],
    irrelevantExamples: [],
    unsupportedDetails: [
      "Nguồn không chọn duy nhất giữa ba cơ chế hộp diêm: đếm bước, tạo tiếng động định hướng và đặt hộp lên người nạn nhân. Không được gộp chúng thành một chuỗi bắt buộc.",
    ],
    needsReview: true,
    enabled: true,
    reviewNotes: [
      "Đáp án bí mật trộn ba cơ chế hộp diêm không hoàn toàn tương thích. Giữ cả ba như các phương án nguồn cho phép; câu hỏi Có/Không phân biệt cơ chế phải được phán quyết KHONG_QUAN_TRONG.",
    ],
  },
  {
    id: "case-04",
    number: 4,
    title: "Vòng lặp tử thần (Chủ đề Thuật toán/Hệ thống)",
    difficulty: "4/5 (Đòi hỏi tư duy về nhân quả hệ thống và tài nguyên)",
    publicStory:
      "Một nam thanh niên ngồi trước máy tính, viết một đoạn mã cực kỳ ngắn và cơ bản để in ra dòng chữ 'Hello'. Anh ta mỉm cười và ấn nút Chạy (Run). Vài phút sau, còi báo động của cả tòa nhà vang lên inh ỏi. Hệ thống phun nước khẩn cấp kích hoạt, làm ướt sũng mọi thứ. Anh ta bị cảnh sát vũ trang ập vào bắt giữ ngay sau đó với cáo buộc khủng bố, dù anh ta không hề có vũ khí hay chất nổ. Tại sao?",
    coreFacts: [
      {
        id: "case-04-core-01",
        text: "Nam thanh niên là thực tập sinh tại trung tâm dữ liệu điều khiển hệ thống làm mát của lò phản ứng hạt nhân hoặc một máy chủ quốc gia trọng yếu.",
      },
      {
        id: "case-04-core-02",
        text: "Anh ta lén dùng máy chủ chính để chạy thử mã cá nhân.",
      },
      {
        id: "case-04-core-03",
        text: "Lỗi logic tạo ra một vòng lặp vô hạn không có điểm dừng, khiến máy chủ dùng 100% CPU.",
      },
      {
        id: "case-04-core-04",
        text: "CPU quá tải gây quá nhiệt cục bộ; cảm biến nhận diện nhiệt tăng đột biến là hỏa hoạn và kích hoạt phun nước cùng báo động an ninh.",
      },
      {
        id: "case-04-core-05",
        text: "Việc xảy ra trên hệ thống trọng yếu dẫn tới cảnh sát vũ trang bắt anh ta với cáo buộc khủng bố.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-04-false-01",
        text: "Đoạn mã không chứa virus.",
      },
      {
        id: "case-04-false-02",
        text: "Dòng chữ Hello không phải mật mã kích hoạt bom.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-04-required-01",
        text: "Đoạn mã lỗi tạo ra vòng lặp vô hạn làm quá tải CPU của hệ thống trọng yếu.",
      },
      {
        id: "case-04-required-02",
        text: "Máy chủ quá nhiệt khiến cảm biến kích hoạt hệ thống phun nước và báo động an ninh.",
      },
      {
        id: "case-04-required-03",
        text: "Anh ta bị bắt vì đã gây sự cố trên hệ thống trọng yếu, dù không có vũ khí hay chất nổ.",
      },
    ],
    optionalFacts: [
      {
        id: "case-04-optional-01",
        text: "Anh ta là thực tập sinh và chạy mã cá nhân trên máy chủ chính.",
      },
    ],
    acceptedAlternatives: [
      "Nguồn cho phép bối cảnh là hệ thống làm mát lò phản ứng hạt nhân hoặc máy chủ lưu trữ quốc gia trọng yếu.",
    ],
    irrelevantExamples: [],
    unsupportedDetails: [],
    needsReview: false,
    enabled: true,
    reviewNotes: [],
  },
  {
    id: "case-05",
    number: 5,
    title: "Bữa tiệc trên hoang đảo (Chủ đề Tâm lý/Suy luận u ám)",
    difficulty:
      "5/5 (Kinh điển, rùng rợn và đòi hỏi khả năng móc nối các sự kiện trong quá khứ)",
    publicStory:
      "Hai người đàn ông bước vào một nhà hàng hải sản sang trọng ven biển. Cả hai cùng gọi món 'Thịt chim hải âu nướng'. Người thứ nhất cắn một miếng, nhai chậm rãi, nước mắt trào ra rồi đột ngột rút súng tự sát ngay tại bàn. Người thứ hai cắn một miếng, mỉm cười nhẹ nhõm, đặt nĩa xuống rồi lấy điện thoại gọi cho cảnh sát để tự thú tội giết người. Chuyện gì đã xảy ra?",
    coreFacts: [
      {
        id: "case-05-core-01",
        text: "Trong quá khứ, hai người đàn ông và vợ của người thứ nhất bị đắm tàu rồi trôi dạt lên một hoang đảo.",
      },
      {
        id: "case-05-core-02",
        text: "Khi thức ăn cạn kiệt, người vợ mất tích; người thứ hai mang thịt về và nói dối rằng đó là thịt chim hải âu.",
      },
      {
        id: "case-05-core-03",
        text: "Người thứ hai đã sát hại người vợ và cho người thứ nhất ăn thịt của cô để sinh tồn.",
      },
      {
        id: "case-05-core-04",
        text: "Tại nhà hàng, vị thịt chim hải âu thật khác hẳn vị thịt trên đảo, khiến người thứ nhất nhận ra mình từng ăn thịt vợ.",
      },
      {
        id: "case-05-core-05",
        text: "Cú sốc khiến người thứ nhất tự sát; người thứ hai biết bí mật đã lộ nên gọi cảnh sát tự thú giết người.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-05-false-01",
        text: "Món ăn tại nhà hàng không bị tẩm độc.",
      },
      {
        id: "case-05-false-02",
        text: "Hai người đàn ông không có thù oán với nhau trước bữa ăn.",
      },
      {
        id: "case-05-false-03",
        text: "Miếng thịt tại nhà hàng không có cùng vị với thứ thịt họ đã ăn trên đảo.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-05-required-01",
        text: "Hai người từng mắc kẹt trên hoang đảo cùng vợ người thứ nhất và thiếu thức ăn.",
      },
      {
        id: "case-05-required-02",
        text: "Người thứ hai giết người vợ rồi nói dối rằng thịt của cô là thịt chim hải âu để họ ăn sống sót.",
      },
      {
        id: "case-05-required-03",
        text: "Vị thịt chim hải âu thật khiến người thứ nhất nhận ra sự thật và tự sát, còn người thứ hai tự thú.",
      },
    ],
    optionalFacts: [
      {
        id: "case-05-optional-01",
        text: "Họ sống nhờ thứ thịt đó cho tới khi được cứu.",
      },
    ],
    acceptedAlternatives: [],
    irrelevantExamples: [],
    unsupportedDetails: [],
    needsReview: false,
    enabled: true,
    reviewNotes: [],
  },
  {
    id: "case-06",
    number: 6,
    title: "Cú nhảy hối hận (Chủ đề Môi trường/Vật lý rập khuôn)",
    difficulty: "4.5/5 (Rất dễ bị đánh lừa bởi những định kiến thông thường)",
    publicStory:
      "Một người đàn ông đang đứng ở tầng 20 của một tòa nhà. Anh ta tuyệt vọng bước ra ngoài cửa sổ và nhảy xuống. Khi rơi ngang qua tầng 15, anh ta bất chợt nghe thấy tiếng chuông điện thoại reo vang từ trong một căn phòng. Ngay khoảnh khắc đó, anh ta khóc nấc lên và hối hận tột cùng vì đã nhảy. Tiếng chuông điện thoại đó có ý nghĩa gì?",
    coreFacts: [
      {
        id: "case-06-core-01",
        text: "Thế giới vừa trải qua một thảm họa hạt nhân hoặc đại dịch toàn cầu cực kỳ tàn khốc.",
      },
      {
        id: "case-06-core-02",
        text: "Người đàn ông sống sót, tìm kiếm nhiều năm nhưng không thấy ai và tin mình là sinh vật sống duy nhất còn lại trên Trái Đất.",
      },
      {
        id: "case-06-core-03",
        text: "Sự cô đơn và tuyệt vọng khiến anh ta quyết định nhảy lầu tự sát.",
      },
      {
        id: "case-06-core-04",
        text: "Tiếng chuông điện thoại khi anh ta đang rơi chứng minh hệ thống liên lạc vẫn có người kích hoạt, tức vẫn còn người sống sót ở đâu đó.",
      },
      {
        id: "case-06-core-05",
        text: "Anh ta hối hận vì đã từ bỏ hy vọng ngay trước khi biết mình không phải người sống sót duy nhất.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-06-false-01",
        text: "Anh ta không nhảy vì đang chờ một cuộc gọi quan trọng về vay tiền hoặc cứu viện.",
      },
      {
        id: "case-06-false-02",
        text: "Tiếng chuông không phải tín hiệu liên quan tới việc gia đình anh ta bị bắt cóc hay được thả.",
      },
      {
        id: "case-06-false-03",
        text: "Trước khi nghe chuông, anh ta tin tòa nhà, thành phố và Trái Đất không còn người nào khác.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-06-required-01",
        text: "Sau một thảm họa toàn cầu, anh ta tin mình là người sống sót duy nhất và vì tuyệt vọng nên nhảy lầu.",
      },
      {
        id: "case-06-required-02",
        text: "Tiếng điện thoại reo chứng minh vẫn còn một người sống khác có thể kích hoạt liên lạc.",
      },
      {
        id: "case-06-required-03",
        text: "Nhận ra mình đã từ bỏ hy vọng quá sớm khiến anh ta hối hận khi đang rơi.",
      },
    ],
    optionalFacts: [
      {
        id: "case-06-optional-01",
        text: "Anh ta đã lang thang tìm kiếm người sống trong nhiều năm.",
      },
    ],
    acceptedAlternatives: [
      "Nguồn cho phép thảm họa nền là thảm họa hạt nhân hoặc một đại dịch toàn cầu.",
    ],
    irrelevantExamples: [
      "Danh tính và mối quan hệ của người gọi với người đàn ông không quan trọng.",
    ],
    unsupportedDetails: [],
    needsReview: false,
    enabled: true,
    reviewNotes: [],
  },
  {
    id: "case-07",
    number: 7,
    title: "Bản nhạc câm lặng",
    difficulty: "5/5 (Thiên về tư duy logic vật lý, sóng âm và cơ chế thiết bị)",
    publicStory:
      "Một nghệ sĩ vĩ cầm nổi tiếng đang biểu diễn độc tấu trên sân khấu lớn trước hàng ngàn khán giả. Giữa buổi diễn, anh ta đột ngột dừng lại, mặt tái mét. Anh ta không hề bị đột quỵ, nhạc cụ không hề bị hỏng và anh ta cũng không hề quên bài. Anh ta lập tức rời sân khấu, đi thẳng ra cây cầu gần nhất và nhảy xuống sông tự sát. Tại sao?",
    coreFacts: [
      {
        id: "case-07-core-01",
        text: "Nghệ sĩ mắc một chứng bệnh về tai nhưng không biết.",
      },
      {
        id: "case-07-core-02",
        text: "Bản nhạc có đoạn cao trào dùng các nốt tần số cực cao, tiệm cận ngưỡng siêu âm.",
      },
      {
        id: "case-07-core-03",
        text: "Khi chơi đến đoạn đó, tai anh ta bị tổn thương nghiêm trọng và anh ta đột ngột mất hoàn toàn thính giác.",
      },
      {
        id: "case-07-core-04",
        text: "Anh ta biết tay mình vẫn chơi chính xác và khán giả vẫn lắng nghe, nên hiểu cây đàn vẫn phát tiếng còn bản thân đã bị điếc.",
      },
      {
        id: "case-07-core-05",
        text: "Nhận ra đã mất thính giác, điều quý giá nhất đối với mình, khiến anh ta sụp đổ và tự sát.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-07-false-01",
        text: "Anh ta không dừng lại vì nghe thấy một âm thanh lạ; mấu chốt là anh ta không còn nghe thấy âm thanh.",
      },
      {
        id: "case-07-false-02",
        text: "Khán giả không phản ứng tiêu cực và vẫn chăm chú lắng nghe.",
      },
      {
        id: "case-07-false-03",
        text: "Anh ta không bị đột quỵ, không quên bài và cây vĩ cầm không bị hỏng.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-07-required-01",
        text: "Đoạn nhạc có tần số cực cao làm tai anh ta tổn thương và gây điếc đột ngột.",
      },
      {
        id: "case-07-required-02",
        text: "Chuyển động chơi đàn và phản ứng khán giả cho anh ta biết đàn vẫn phát tiếng nhưng mình không thể nghe.",
      },
      {
        id: "case-07-required-03",
        text: "Việc mất thính giác khiến nghệ sĩ tuyệt vọng và tự sát.",
      },
    ],
    optionalFacts: [
      {
        id: "case-07-optional-01",
        text: "Anh ta vốn mắc bệnh về tai nhưng không hề hay biết.",
      },
    ],
    acceptedAlternatives: [],
    irrelevantExamples: [],
    unsupportedDetails: [],
    needsReview: false,
    enabled: true,
    reviewNotes: [],
  },
  {
    id: "case-08",
    number: 8,
    title: "Kẻ sát nhân vô hình",
    difficulty: "5/5 (Bẫy tâm lý rập khuôn về không gian và thời gian)",
    publicStory:
      "Một người phụ nữ mua một căn nhà cũ ở vùng ngoại ô. Ngay đêm đầu tiên chuyển đến ngủ, cô đã bị bóp cổ chết ngay trên giường. Cảnh sát kiểm tra toàn bộ camera an ninh: Không một ai ra vào ngôi nhà. Cửa lớn và cửa sổ đều khóa chặt từ bên trong. Khám nghiệm tử thi khẳng định cô bị giết bởi lực tay của một người trưởng thành rất mạnh, hoàn toàn không phải tự tử hay do bệnh lý. Hỏi hung thủ đã vào và ra bằng cách nào?",
    coreFacts: [
      {
        id: "case-08-core-01",
        text: "Hung thủ là chủ cũ của căn nhà và không có mặt ở đó vào đêm nạn nhân chết.",
      },
      {
        id: "case-08-core-02",
        text: "Trước khi bán nhà, hắn lắp một bẫy cơ khí tinh vi ẩn trong chiếc giường gỗ.",
      },
      {
        id: "case-08-core-03",
        text: "Bẫy gồm hai cánh tay robot bằng thép mô phỏng tay người, cảm biến áp suất dưới đệm và đồng hồ hẹn giờ.",
      },
      {
        id: "case-08-core-04",
        text: "Khi nạn nhân nằm đúng vị trí và đồng hồ điểm nửa đêm, hai tay máy bật ra, siết cổ cô rồi tự rụt vào hốc bí mật.",
      },
      {
        id: "case-08-core-05",
        text: "Tay máy được bọc da nhân tạo để đánh lừa dấu vết khám nghiệm ban đầu; hung thủ gây án từ xa hàng trăm cây số.",
      },
      {
        id: "case-08-core-06",
        text: "Chủ cũ được nguồn mô tả là một người mắc tâm thần phân liệt.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-08-false-01",
        text: "Hung thủ không trốn sẵn trong nhà trước khi nạn nhân đến.",
      },
      {
        id: "case-08-false-02",
        text: "Ngôi nhà không có lối đi bí mật dưới đất hoặc trên trần để hung thủ ra vào.",
      },
      {
        id: "case-08-false-03",
        text: "Hung thủ không trực tiếp chạm vào nạn nhân trong đêm cô chết.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-08-required-01",
        text: "Chủ cũ đã cài sẵn một bẫy cơ khí có tay robot trong giường trước khi bán nhà.",
      },
      {
        id: "case-08-required-02",
        text: "Cảm biến và đồng hồ kích hoạt tay máy bóp cổ nạn nhân rồi làm nó rụt vào chỗ giấu.",
      },
      {
        id: "case-08-required-03",
        text: "Hung thủ không cần vào hoặc ra khỏi nhà trong đêm xảy ra án mạng vì cơ chế đã được thiết lập từ trước.",
      },
    ],
    optionalFacts: [
      {
        id: "case-08-optional-01",
        text: "Tay máy bằng thép được bọc da nhân tạo và giấu trong giường gỗ.",
      },
      {
        id: "case-08-optional-02",
        text: "Bẫy kích hoạt khi nạn nhân nằm đúng vị trí vào lúc nửa đêm.",
      },
    ],
    acceptedAlternatives: [
      "Chấp nhận cách gọi cơ chế là tay máy, cánh tay robot, tay cơ khí hoặc bẫy tự động giấu trong giường.",
    ],
    irrelevantExamples: [],
    unsupportedDetails: [],
    needsReview: false,
    enabled: true,
    reviewNotes: [],
  },
  {
    id: "case-09",
    number: 9,
    title: "Chuyến bay ngột ngạt",
    difficulty:
      "5.5/5 (Thiên về tư duy hệ thống, logic loại trừ biến số môi trường)",
    publicStory:
      "Một phi công đang lái một chiếc máy bay trực thăng tư nhân chở theo 3 hành khách VIP. Khi đang bay ở độ cao ổn định và thời tiết hoàn hảo, phi công bất ngờ quay lại, dùng súng bắn chết cả 3 hành khách. Ngay sau đó, anh ta mở cửa buồng lái và nhảy xuống đất tự sát mà không hề mặc áo dù. Toàn bộ quá trình được hộp đen ghi lại. Anh ta không bị điên, không bị ép buộc, và chiếc máy bay cũng không hề gặp trục trặc kỹ thuật. Tại sao anh ta lại hành động như vậy?",
    coreFacts: [
      {
        id: "case-09-core-01",
        text: "Trực thăng đang bay trên một thung lũng cô lập vừa bị rò rỉ khí độc chết người phủ kín mặt đất.",
      },
      {
        id: "case-09-core-02",
        text: "Đáp án bí mật nói kim báo nhiên liệu bị hỏng và trực thăng sẽ cạn nhiên liệu trong vòng năm phút.",
      },
      {
        id: "case-09-core-03",
        text: "Khi hết nhiên liệu, trực thăng buộc phải rơi xuống vùng thung lũng đầy khí độc.",
      },
      {
        id: "case-09-core-04",
        text: "Trên trực thăng chỉ có một mặt nạ chống độc dự phòng cho bốn người.",
      },
      {
        id: "case-09-core-05",
        text: "Phi công bắn ba hành khách để họ không phải chết chậm và đau đớn vì khí độc, rồi nhảy xuống tự sát để chết nhanh.",
      },
      {
        id: "case-09-core-06",
        text: "Đề bài khẳng định trực thăng không gặp trục trặc kỹ thuật, mâu thuẫn với chi tiết kim báo nhiên liệu bị hỏng trong đáp án.",
      },
    ],
    explicitFalseFacts: [
      {
        id: "case-09-false-01",
        text: "Phi công không bị điên và không bị ép buộc.",
      },
      {
        id: "case-09-false-02",
        text: "Các hành khách không mang theo vật nguy hiểm.",
      },
      {
        id: "case-09-false-03",
        text: "Thời tiết không xấu; trực thăng đang ở độ cao ổn định khi sự việc bắt đầu.",
      },
    ],
    requiredCoreFacts: [
      {
        id: "case-09-required-01",
        text: "Trực thăng sắp hết nhiên liệu và sẽ rơi xuống vùng mặt đất bị khí độc chết người bao phủ.",
      },
      {
        id: "case-09-required-02",
        text: "Chỉ có một mặt nạ chống độc cho bốn người nên họ không thể cùng sống sót khi rơi xuống.",
      },
      {
        id: "case-09-required-03",
        text: "Phi công giết hành khách rồi tự sát để mọi người chết nhanh thay vì chịu cái chết chậm vì khí độc.",
      },
    ],
    optionalFacts: [
      {
        id: "case-09-optional-01",
        text: "Nguồn nói kim báo nhiên liệu bị hỏng và chỉ còn khoảng năm phút trước khi cạn nhiên liệu.",
      },
    ],
    acceptedAlternatives: [
      "Chấp nhận cách diễn đạt rằng trực thăng sẽ rơi, hạ xuống hoặc cạn nhiên liệu trên vùng khí độc.",
    ],
    irrelevantExamples: [],
    unsupportedDetails: [
      "Không được tự hòa giải phát biểu “không hề gặp trục trặc kỹ thuật” với chi tiết “kim báo nhiên liệu bị hỏng”. Câu hỏi Có/Không phụ thuộc trực tiếp vào điểm này phải được phán quyết KHONG_QUAN_TRONG.",
    ],
    needsReview: true,
    enabled: true,
    reviewNotes: [
      "Nguồn mâu thuẫn: đề bài nói máy bay không gặp trục trặc kỹ thuật, còn đáp án nói kim báo nhiên liệu bị hỏng. Giữ nguyên cả hai và không tự chọn một phiên bản.",
    ],
  },
];

export function getCaseById(caseId: string): CaseDefinition | undefined {
  return CASES.find((caseDefinition) => caseDefinition.id === caseId);
}

export { serializePublicCase, serializePublicCases };
